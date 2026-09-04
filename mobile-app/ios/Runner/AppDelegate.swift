import AuthenticationServices
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var passkeyBridge: PasskeyBridge?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)

    let messenger = engineBridge.applicationRegistrar.messenger()
    passkeyBridge = PasskeyBridge(messenger: messenger)
  }
}

private final class PasskeyBridge: NSObject,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding {
  private let channel: FlutterMethodChannel
  private var pendingResult: FlutterResult?
  private var authorizationController: ASAuthorizationController?

  init(messenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(
      name: "com.fitnessplatform.app/passkeys",
      binaryMessenger: messenger
    )
    super.init()

    channel.setMethodCallHandler { [weak self] call, result in
      self?.handle(call: call, result: result)
    }
  }

  private func handle(call: FlutterMethodCall, result: @escaping FlutterResult) {
    guard #available(iOS 15.0, *) else {
      result(FlutterError(
        code: "UNSUPPORTED",
        message: "Native passkeys require iOS 15 or newer. Use password login instead.",
        details: nil
      ))
      return
    }

    guard call.method == "register" || call.method == "authenticate" else {
      result(FlutterMethodNotImplemented)
      return
    }
    guard pendingResult == nil else {
      result(FlutterError(code: "PLATFORM_ERROR", message: "A passkey operation is already in progress", details: nil))
      return
    }
    guard let arguments = call.arguments as? [String: Any],
          let optionsJson = arguments["optionsJson"] as? String,
          let optionsData = optionsJson.data(using: .utf8),
          let options = try? JSONSerialization.jsonObject(with: optionsData) as? [String: Any]
    else {
      result(FlutterError(code: "PLATFORM_ERROR", message: "Invalid passkey options", details: nil))
      return
    }

    pendingResult = result
    if call.method == "register" {
      startRegistration(options: options)
    } else {
      startAuthentication(options: options)
    }
  }

  @available(iOS 15.0, *)
  private func startRegistration(options: [String: Any]) {
    guard let rp = options["rp"] as? [String: Any],
          let relyingPartyIdentifier = rp["id"] as? String,
          let user = options["user"] as? [String: Any],
          let userName = user["name"] as? String,
          let userIdString = user["id"] as? String,
          let challengeString = options["challenge"] as? String,
          let challenge = Data(base64URLEncoded: challengeString),
          let userId = Data(base64URLEncoded: userIdString)
    else {
      finish(errorCode: "PLATFORM_ERROR", message: "Invalid passkey registration options")
      return
    }

    let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
      relyingPartyIdentifier: relyingPartyIdentifier
    )
    let request = provider.createCredentialRegistrationRequest(
      challenge: challenge,
      name: userName,
      userID: userId
    )
    let controller = ASAuthorizationController(authorizationRequests: [request])
    controller.delegate = self
    controller.presentationContextProvider = self
    authorizationController = controller
    controller.performRequests()
  }

  @available(iOS 15.0, *)
  private func startAuthentication(options: [String: Any]) {
    guard let relyingPartyIdentifier = options["rpId"] as? String,
          let challengeString = options["challenge"] as? String,
          let challenge = Data(base64URLEncoded: challengeString)
    else {
      finish(errorCode: "PLATFORM_ERROR", message: "Invalid passkey authentication options")
      return
    }

    let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
      relyingPartyIdentifier: relyingPartyIdentifier
    )
    let request = provider.createCredentialAssertionRequest(challenge: challenge)
    if let allowedCredentials = options["allowCredentials"] as? [[String: Any]] {
      request.allowedCredentials = allowedCredentials.compactMap { descriptor in
        guard let id = descriptor["id"] as? String,
              let credentialId = Data(base64URLEncoded: id) else { return nil }
        return ASAuthorizationPlatformPublicKeyCredentialDescriptor(credentialID: credentialId)
      }
    }

    let controller = ASAuthorizationController(authorizationRequests: [request])
    controller.delegate = self
    controller.presentationContextProvider = self
    authorizationController = controller
    controller.performRequests()
  }

  func authorizationController(
    controller: ASAuthorizationController,
    didCompleteWithAuthorization authorization: ASAuthorization
  ) {
    if #available(iOS 15.0, *) {
      if let registration = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration {
        finish(json: [
          "id": registration.credentialID.base64URLEncodedString,
          "rawId": registration.credentialID.base64URLEncodedString,
          "response": [
            "clientDataJSON": registration.rawClientDataJSON.base64URLEncodedString,
            "attestationObject": registration.rawAttestationObject.base64URLEncodedString
          ],
          "type": "public-key",
          "clientExtensionResults": [:]
        ])
        return
      }

      if let assertion = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion {
        var response: [String: Any] = [
          "clientDataJSON": assertion.rawClientDataJSON.base64URLEncodedString,
          "authenticatorData": assertion.rawAuthenticatorData.base64URLEncodedString,
          "signature": assertion.signature.base64URLEncodedString
        ]
        if let userID = assertion.userID {
          response["userHandle"] = userID.base64URLEncodedString
        }
        finish(json: [
          "id": assertion.credentialID.base64URLEncodedString,
          "rawId": assertion.credentialID.base64URLEncodedString,
          "response": response,
          "type": "public-key",
          "clientExtensionResults": [:]
        ])
        return
      }
    }
    finish(errorCode: "PLATFORM_ERROR", message: "Unsupported passkey credential response")
  }

  func authorizationController(
    controller: ASAuthorizationController,
    didCompleteWithError error: Error
  ) {
    let nsError = error as NSError
    if nsError.domain == ASAuthorizationError.errorDomain,
       nsError.code == ASAuthorizationError.canceled.rawValue {
      finish(errorCode: "CANCELLED", message: "Passkey operation was cancelled")
    } else {
      finish(errorCode: "PLATFORM_ERROR", message: error.localizedDescription)
    }
  }

  func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    return scenes.flatMap(\.windows).first(where: { $0.isKeyWindow })
      ?? scenes.flatMap(\.windows).first
      ?? UIWindow()
  }

  private func finish(json: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: json),
          let string = String(data: data, encoding: .utf8) else {
      finish(errorCode: "PLATFORM_ERROR", message: "Could not encode passkey response")
      return
    }
    let result = pendingResult
    pendingResult = nil
    authorizationController = nil
    result?(string)
  }

  private func finish(errorCode: String, message: String) {
    let result = pendingResult
    pendingResult = nil
    authorizationController = nil
    result?(FlutterError(code: errorCode, message: message, details: nil))
  }
}

private extension Data {
  init?(base64URLEncoded value: String) {
    var encoded = value.replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/")
    encoded += String(repeating: "=", count: (4 - encoded.count % 4) % 4)
    self.init(base64Encoded: encoded)
  }

  var base64URLEncodedString: String {
    base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }
}
