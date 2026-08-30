# Proguard rules for Fitness Platform Mobile App

# Keep flutter_secure_storage classes and hardware keystore encryption helpers
-keep class androidx.security.crypto.** { *; }
-dontwarn androidx.security.crypto.**

-keep class com.it_nomads.fluttersecurestorage.** { *; }
-dontwarn com.it_nomads.fluttersecurestorage.**

# Keep connectivity_plus network callback classes
-keep class dev.fluttercommunity.plus.connectivity.** { *; }
-dontwarn dev.fluttercommunity.plus.connectivity.**
