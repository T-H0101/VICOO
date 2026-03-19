package org.tonghua.app.data.api

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import org.tonghua.app.BuildConfig
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * OkHttp client configuration with auth token interceptor.
 */
@Singleton
class ApiClient @Inject constructor(
    @ApplicationContext private val context: Context,
    private val tokenProvider: TokenProvider,
) {
    companion object {
        private const val BASE_URL = "https://api.tonghua.org/api/v1/"
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
            .addInterceptor(authInterceptor())
            .addInterceptor(loggingInterceptor())
            .build()
    }

    private fun authInterceptor(): Interceptor = Interceptor { chain ->
        val token = tokenProvider.getAccessToken()
        val request = if (token != null) {
            chain.request().newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .build()
        } else {
            chain.request()
        }
        chain.proceed(request)
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
 * Interface for providing auth tokens.
 * Implemented in DI module with DataStore-backed implementation.
 */
interface TokenProvider {
    fun getAccessToken(): String?
    fun getRefreshToken(): String?
    suspend fun initialize()
    suspend fun saveTokens(accessToken: String, refreshToken: String)
    suspend fun clearTokens()
}
