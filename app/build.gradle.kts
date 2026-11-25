plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Play Store signing key: CI me GitHub Secrets se aata hai (repo me kabhi commit nahi hota)
val keystorePath: String? = System.getenv("KEYSTORE_FILE")

android {
    namespace = "com.vaidyaashwani.livecalltranslator"
    compileSdk = 36

    defaultConfig {
        applicationId = "in.vaidyaashwani.livecalltranslator"
        minSdk = 26
        targetSdk = 36
        versionCode = (project.findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = (project.findProperty("versionName") as String?) ?: "1.0"
    }

    // App ka poora design (HTML/CSS/JS) ../web folder se APK ke andar jaata hai
    sourceSets["main"].assets.srcDirs("../web")

    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (keystorePath != null) signingConfigs.getByName("release")
                            else signingConfigs.getByName("debug")
        }
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.webkit:webkit:1.14.0")
}
