import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
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
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
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
                signingConfig = null
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

// Fail closed during release tasks when keystore configuration is absent or invalid
gradle.taskGraph.whenReady {
    val isReleaseTask = allTasks.any { task ->
        task.name.contains("Release", ignoreCase = true) &&
        (task.name.startsWith("assemble") || task.name.startsWith("bundle") || task.name.startsWith("package"))
    }
    if (isReleaseTask && !isReleaseSigningConfigured) {
        throw org.gradle.api.GradleException(
            "FATAL: Production release build requires valid Android Keystore signing credentials. " +
            "Please provide a valid android/key.properties file or configure ANDROID_KEYSTORE_* environment variables pointing to an existing keystore file."
        )
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
