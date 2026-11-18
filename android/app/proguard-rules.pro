# Keep WebView JavaScript interface classes if any are added in the future (none by default)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# WebView / Chromium
-keep class android.webkit.** { *; }
-dontwarn android.webkit.**
