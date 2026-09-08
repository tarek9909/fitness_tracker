import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/api/api_config.dart';

void main() {
  group('ApiConfig & Release URL Validation Suite', () {
    test('Release mode defaults to onlineProductionBaseUrl when API_BASE_URL is empty or whitespace', () {
      final emptyResult = ApiConfig.validateAndResolveBaseUrl(
        definedUrl: '',
        isReleaseMode: true,
      );
      expect(emptyResult, ApiConfig.onlineProductionBaseUrl);

      final whitespaceResult = ApiConfig.validateAndResolveBaseUrl(
        definedUrl: '   ',
        isReleaseMode: true,
      );
      expect(whitespaceResult, ApiConfig.onlineProductionBaseUrl);
    });

    test('Release mode rejects unencrypted http:// URLs', () {
      expect(
        () => ApiConfig.validateAndResolveBaseUrl(
          definedUrl: 'http://api.fitnessplatform.com/api/v1',
          isReleaseMode: true,
        ),
        throwsA(isA<ReleaseConfigurationError>()),
      );

      expect(
        () => ApiConfig.validateAndResolveBaseUrl(
          definedUrl: 'http://localhost:4000/api/v1',
          isReleaseMode: true,
        ),
        throwsA(isA<ReleaseConfigurationError>()),
      );
    });

    test('Release mode accepts valid HTTPS URLs', () {
      final url = ApiConfig.validateAndResolveBaseUrl(
        definedUrl: 'https://api.fitnessplatform.com/api/v1',
        isReleaseMode: true,
      );
      expect(url, 'https://api.fitnessplatform.com/api/v1');
    });

    test(
        'Debug mode returns Android emulator host alias when on Android with no define',
        () {
      final url = ApiConfig.validateAndResolveBaseUrl(
        definedUrl: '',
        isReleaseMode: false,
        isAndroid: true,
      );
      expect(url, 'http://10.0.2.2:4000/api/v1');
    });

    test('Debug mode returns localhost when not on Android with no define', () {
      final url = ApiConfig.validateAndResolveBaseUrl(
        definedUrl: '',
        isReleaseMode: false,
        isAndroid: false,
      );
      expect(url, 'http://localhost:4000/api/v1');
    });

    test('Debug mode respects explicit --dart-define even if http://', () {
      final url = ApiConfig.validateAndResolveBaseUrl(
        definedUrl: 'http://192.168.1.50:4000/api/v1',
        isReleaseMode: false,
        isAndroid: true,
      );
      expect(url, 'http://192.168.1.50:4000/api/v1');
    });

    test('Normalizes and strips trailing slashes from API_BASE_URL', () {
      final releaseUrl = ApiConfig.validateAndResolveBaseUrl(
        definedUrl: 'https://api.fitnessplatform.com/api/v1///',
        isReleaseMode: true,
      );
      expect(releaseUrl, 'https://api.fitnessplatform.com/api/v1');

      final debugUrl = ApiConfig.validateAndResolveBaseUrl(
        definedUrl: 'http://192.168.1.50:4000/api/v1/',
        isReleaseMode: false,
      );
      expect(debugUrl, 'http://192.168.1.50:4000/api/v1');
    });

    test('Release mode rejects URLs without a valid host', () {
      expect(
        () => ApiConfig.validateAndResolveBaseUrl(
          definedUrl: 'https:///api/v1',
          isReleaseMode: true,
        ),
        throwsA(isA<ReleaseConfigurationError>()),
      );

      expect(
        () => ApiConfig.validateAndResolveBaseUrl(
          definedUrl: 'https://',
          isReleaseMode: true,
        ),
        throwsA(isA<ReleaseConfigurationError>()),
      );
    });

    test('Release mode rejects URLs with embedded user credentials', () {
      expect(
        () => ApiConfig.validateAndResolveBaseUrl(
          definedUrl: 'https://user:pass@api.fitnessplatform.com/api/v1',
          isReleaseMode: true,
        ),
        throwsA(isA<ReleaseConfigurationError>()),
      );
    });

    test('Release mode rejects URLs with invalid or out-of-range ports', () {
      expect(
        () => ApiConfig.validateAndResolveBaseUrl(
          definedUrl: 'https://api.fitnessplatform.com:0/api/v1',
          isReleaseMode: true,
        ),
        throwsA(isA<ReleaseConfigurationError>()),
      );

      expect(
        () => ApiConfig.validateAndResolveBaseUrl(
          definedUrl: 'https://api.fitnessplatform.com:70000/api/v1',
          isReleaseMode: true,
        ),
        throwsA(isA<ReleaseConfigurationError>()),
      );

      expect(
        () => ApiConfig.validateAndResolveBaseUrl(
          definedUrl: 'https://api.fitnessplatform.com:invalid/api/v1',
          isReleaseMode: true,
        ),
        throwsA(isA<ReleaseConfigurationError>()),
      );
    });

    test('Release mode accepts valid HTTPS URLs with custom valid port', () {
      final url = ApiConfig.validateAndResolveBaseUrl(
        definedUrl: 'https://api.fitnessplatform.com:8443/api/v1',
        isReleaseMode: true,
      );
      expect(url, 'https://api.fitnessplatform.com:8443/api/v1');
    });

    test('Candidate base URLs contain active LAN IP and reverse proxy ports 3000 & 4000', () {
      final candidates = ApiConfig.getCandidateBaseUrls();
      expect(candidates, isNotEmpty);
      expect(candidates.any((c) => c.contains(':3000/api/v1')), isTrue);
      expect(candidates.any((c) => c.contains(':4000/api/v1')), isTrue);
      expect(candidates.any((c) => c.contains('192.168.10.210')), isTrue);
    });

    test('Setting active working base URL prioritizes it and resolveBaseUrl returns it', () {
      addTearDown(() => ApiConfig.resetActiveWorkingBaseUrl());

      ApiConfig.setActiveWorkingBaseUrl('http://127.0.0.1:3000/api/v1');
      expect(ApiConfig.getActiveWorkingBaseUrl(), 'http://127.0.0.1:3000/api/v1');
      expect(ApiConfig.resolveBaseUrl(), 'http://127.0.0.1:3000/api/v1');

      final candidates = ApiConfig.getCandidateBaseUrls();
      expect(candidates.first, 'http://127.0.0.1:3000/api/v1');

      ApiConfig.resetActiveWorkingBaseUrl();
      expect(ApiConfig.getActiveWorkingBaseUrl(), isNull);
    });
  });
}
