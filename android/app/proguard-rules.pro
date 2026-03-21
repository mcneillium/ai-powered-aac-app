# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# TensorFlow Lite / TF.js native bindings
-keep class org.tensorflow.** { *; }
-dontwarn org.tensorflow.**

# Firebase
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Expo modules
-keep class expo.modules.** { *; }
-dontwarn expo.modules.**

# Keep React Native JS interface
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.hermes.** { *; }
-dontwarn com.facebook.hermes.**

# Don't strip annotations used by libraries
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
