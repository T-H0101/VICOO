package org.tonghua.app.data.api

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import org.tonghua.app.BuildConfig
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * OkHttp client configuration with httpOnly Cookie authentication.
 *
 * NOTE: Authentication is handled via httpOnly cookies, not Bearer tokens.
 * The server manages session state via Set-Cookie headers.
 */
@Singleton
class ApiClient @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    companion object {
        private val BASE_URL: String
            get() = BuildConfig.API_BASE_URL
        private const val TIMEOUT_SECONDS = 30L
    }

    val api: TonghuaApi by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(createOkHttpClient())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(TonghuaApi::class.java)
    }

    private fun createOkHttpClient(): OkHttpClient {
        return OkHttpClient.Builder()
            .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .cookieJar(AndroidCookieJar(context))
            .addInterceptor(loggingInterceptor())
            .build()
    }

    private fun loggingInterceptor(): HttpLoggingInterceptor {
        return HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }
    }
}

/**
 * Cookie jar implementation for Android that persists cookies across app sessions.
 * Uses EncryptedSharedPreferences to securely store cookies.
 */
class AndroidCookieJar(private val context: Context) : CookieJar {
    private val prefs by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            "tonghua_cookies_encrypted",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }
    private val cookieKey = "stored_cookies"

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        // Use newline as delimiter since it doesn't appear in cookie strings
        // Each cookie is serialized as a single line
        val serialized = cookies.joinToString("\n") { it.toString() }
        prefs.edit().putString(cookieKey, serialized).apply()
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val serialized = prefs.getString(cookieKey, "") ?: ""
        if (serialized.isEmpty()) return emptyList()

        return serialized.split("\n").mapNotNull { cookieStr ->
            if (cookieStr.trim().isNotEmpty()) {
                try {
                    Cookie.parse(url, cookieStr.trim())
                } catch (e: Exception) {
                    null
                }
            } else {
                null
            }
        }
    }
}
