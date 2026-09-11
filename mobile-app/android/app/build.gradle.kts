import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
}

val keyPropsFile = rootProject.file("key.properties")
var isReleaseSigningConfigured = false

val keyProps = Properties()
if (keyPropsFile.exists()) {
    FileInputStream(keyPropsFile).use { keyProps.load(it) }
}

val envKeystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
val envKeystorePass = System.getenv("ANDROID_KEYSTORE_PASSWORD")
val envKeyAlias = System.getenv("ANDROID_KEY_ALIAS")
val envKeyPass = System.getenv("ANDROID_KEY_PASSWORD")

val hasValidFileProps = keyPropsFile.exists() &&
    !keyProps.getProperty("keyAlias").isNullOrBlank() &&
    !keyProps.getProperty("keyPassword").isNullOrBlank() &&
    !keyProps.getProperty("storePassword").isNullOrBlank() &&
    !keyProps.getProperty("storeFile").isNullOrBlank()

val hasValidEnv = !envKeystorePath.isNullOrBlank() &&
    !envKeystorePass.isNullOrBlank() &&
    !envKeyAlias.isNullOrBlank() &&
    !envKeyPass.isNullOrBlank()

android {
    namespace = "com.fitnessplatform.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.fitnessplatform.app"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasValidFileProps) {
            val keystoreFile = rootProject.file(keyProps.getProperty("storeFile"))
            if (keystoreFile.exists()) {
                create("release") {
                    keyAlias = keyProps.getProperty("keyAlias")
                    keyPassword = keyProps.getProperty("keyPassword")
                    storeFile = keystoreFile
                    storePassword = keyProps.getProperty("storePassword")
                }
                isReleaseSigningConfigured = true
            }
        } else if (hasValidEnv) {
            val keystoreFile = file(envKeystorePath)
            if (keystoreFile.exists()) {
                create("release") {
                    keyAlias = envKeyAlias
                    keyPassword = envKeyPass
                    storeFile = keystoreFile
                    storePassword = envKeystorePass
                }
                isReleaseSigningConfigured = true
            }
        }
    }

    buildTypes {
        release {
            if (isReleaseSigningConfigured) {
                signingConfig = signingConfigs.getByName("release")
            } else {
                signingConfig = signingConfigs.getByName("debug")
            }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
    }

}

// Allow debug signing fallback for device-installable release testing when key.properties is absent
gradle.taskGraph.whenReady {
    val isReleaseTask = allTasks.any { task ->
        task.name.contains("Release", ignoreCase = true) &&
        (task.name.startsWith("assemble") || task.name.startsWith("bundle") || task.name.startsWith("package"))
    }
    if (isReleaseTask && !isReleaseSigningConfigured) {
        logger.warn(
            "WARNING: Building release APK with debug signing fallback for physical device testing."
        )
    }
}

flutter {
    source = "../.."
}

dependencies {
    // Android 9/API 28+ platform passkeys through Credential Manager.
    implementation("androidx.credentials:credentials:1.7.0-alpha02")
    implementation("androidx.credentials:credentials-play-services-auth:1.7.0-alpha02")
}
