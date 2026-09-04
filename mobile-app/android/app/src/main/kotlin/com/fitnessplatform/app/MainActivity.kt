package com.fitnessplatform.app

import android.os.Build
import androidx.credentials.CredentialManager
import androidx.credentials.CredentialManagerCallback
import androidx.credentials.CreateCredentialRequest
import androidx.credentials.CreateCredentialResponse
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.CreateCredentialUnsupportedException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.android.FlutterActivity
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private lateinit var credentialManager: CredentialManager

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        credentialManager = CredentialManager.create(this)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "register" -> handleRegistration(call, result)
                    "authenticate" -> handleAuthentication(call, result)
                    else -> result.notImplemented()
                }
            }
    }

    private fun handleRegistration(call: MethodCall, result: MethodChannel.Result) {
        if (!isSupported(result)) return
        val requestJson = optionsJson(call, result) ?: return

        try {
            val request = CreatePublicKeyCredentialRequest(requestJson)
            credentialManager.createCredentialAsync(
                this,
                request,
                null,
                mainExecutor,
                object : CredentialManagerCallback<CreateCredentialResponse, CreateCredentialException> {
                    override fun onResult(response: CreateCredentialResponse) {
                        if (response is CreatePublicKeyCredentialResponse) {
                            result.success(response.registrationResponseJson)
                        } else {
                            result.error("PLATFORM_ERROR", "Credential provider returned an unsupported response", null)
                        }
                    }

                    override fun onError(e: CreateCredentialException) {
                        result.error(errorCode(e), e.message ?: "Passkey registration failed", null)
                    }
                },
            )
        } catch (e: IllegalArgumentException) {
            result.error("PLATFORM_ERROR", e.message ?: "Invalid passkey registration options", null)
        }
    }

    private fun handleAuthentication(call: MethodCall, result: MethodChannel.Result) {
        if (!isSupported(result)) return
        val requestJson = optionsJson(call, result) ?: return

        try {
            val option = GetPublicKeyCredentialOption(requestJson)
            credentialManager.getCredentialAsync(
                this,
                GetCredentialRequest(listOf(option)),
                null,
                mainExecutor,
                object : CredentialManagerCallback<GetCredentialResponse, GetCredentialException> {
                    override fun onResult(response: GetCredentialResponse) {
                        val credential = response.credential
                        if (credential is PublicKeyCredential) {
                            result.success(credential.authenticationResponseJson)
                        } else {
                            result.error("PLATFORM_ERROR", "Credential provider returned an unsupported response", null)
                        }
                    }

                    override fun onError(e: GetCredentialException) {
                        result.error(errorCode(e), e.message ?: "Passkey authentication failed", null)
                    }
                },
            )
        } catch (e: IllegalArgumentException) {
            result.error("PLATFORM_ERROR", e.message ?: "Invalid passkey authentication options", null)
        }
    }

    private fun isSupported(result: MethodChannel.Result): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            result.error("UNSUPPORTED", "Android passkeys require Android 9/API 28 or newer", null)
            return false
        }
        return true
    }

    private fun optionsJson(call: MethodCall, result: MethodChannel.Result): String? {
        val arguments = call.arguments as? Map<*, *>
        val requestJson = arguments?.get("optionsJson") as? String
        if (requestJson.isNullOrBlank()) {
            result.error("PLATFORM_ERROR", "Passkey options are missing", null)
            return null
        }
        return requestJson
    }

    private fun errorCode(error: Throwable): String = when (error) {
        is CreateCredentialCancellationException,
        is GetCredentialCancellationException -> "CANCELLED"
        is CreateCredentialUnsupportedException,
        is GetCredentialUnsupportedException -> "UNSUPPORTED"
        else -> "PLATFORM_ERROR"
    }

    companion object {
        private const val CHANNEL = "com.fitnessplatform.app/passkeys"
    }
}
