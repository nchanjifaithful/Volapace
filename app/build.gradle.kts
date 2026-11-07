plugins {
    id("com.android.application")
}

android {
    namespace = "app.volapace"
    compileSdk = 34

    defaultConfig {
        applicationId = "app.volapace"
        minSdk = 26
        targetSdk = 34
        // Android needs this to rise with each update. Cloud builds number themselves.
        versionCode = System.getenv("GITHUB_RUN_NUMBER")?.toInt() ?: 1
        versionName = "1.0"
    }

    // Cloud builds sign with one permanent key, because Android only installs an
    // update over the app if the signature matches. Local builds use the debug key.
    val keystorePath = System.getenv("VOLAPACE_KEYSTORE")
    val permanentKey = if (keystorePath == null) null else signingConfigs.create("permanent") {
        storeFile = file(keystorePath)
        storeType = "pkcs12"
        storePassword = System.getenv("VOLAPACE_KEYSTORE_PASSWORD")
        keyAlias = "volapace"
        keyPassword = System.getenv("VOLAPACE_KEYSTORE_PASSWORD")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = permanentKey ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // The UI (React + pdf.js + fonts) is compiled into assets/www by `npm run build` in web/.
    androidResources {
        noCompress += listOf("woff2", "js")
    }
}

// No runtime dependencies: the app uses only the Android framework (WebView, PdfRenderer, AlarmManager).
dependencies {
}

// Fail early with a clear message if the UI hasn't been built.
tasks.register("checkWebUi") {
    doLast {
        if (!file("src/main/assets/www/app.js").exists()) {
            throw GradleException("The UI isn't built. Run: cd web && npm install && npm run build")
        }
    }
}
tasks.named("preBuild") { dependsOn("checkWebUi") }
