package org.tonghua.app.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import org.tonghua.app.data.api.ApiClient
import org.tonghua.app.data.api.TokenProvider
import org.tonghua.app.data.api.TonghuaApi
import javax.inject.Singleton

/**
 * DataStore extension property.
 */
private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "tonghua_prefs")

/**
 * Hilt module providing application-level dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideDataStore(@ApplicationContext context: Context): DataStore<Preferences> {
        return context.dataStore
    }

    @Provides
    @Singleton
    fun provideTokenProvider(dataStore: DataStore<Preferences>): TokenProvider {
        return DataStoreTokenProvider(dataStore)
    }

    @Provides
    @Singleton
    fun provideApiClient(
        @ApplicationContext context: Context,
        tokenProvider: TokenProvider,
    ): ApiClient {
        return ApiClient(context, tokenProvider)
    }

    @Provides
    @Singleton
    fun provideApi(apiClient: ApiClient): TonghuaApi {
        return apiClient.api
    }
}

/**
 * DataStore-backed token provider implementation.
 */
class DataStoreTokenProvider(
    private val dataStore: DataStore<Preferences>,
) : TokenProvider {

    companion object {
        private val ACCESS_TOKEN_KEY = stringPreferencesKey("access_token")
        private val REFRESH_TOKEN_KEY = stringPreferencesKey("refresh_token")
    }

    private var cachedAccessToken: String? = null
    private var cachedRefreshToken: String? = null

    override fun getAccessToken(): String? = cachedAccessToken

    override fun getRefreshToken(): String? = cachedRefreshToken

    override suspend fun initialize() {
        dataStore.data.collect { prefs ->
            cachedAccessToken = prefs[ACCESS_TOKEN_KEY]
            cachedRefreshToken = prefs[REFRESH_TOKEN_KEY]
        }
    }

    override fun getAccessToken(): String? = cachedAccessToken

    override fun getRefreshToken(): String? = cachedRefreshToken

    override suspend fun saveTokens(accessToken: String, refreshToken: String) {
        cachedAccessToken = accessToken
        cachedRefreshToken = refreshToken
        dataStore.edit { prefs ->
            prefs[ACCESS_TOKEN_KEY] = accessToken
            prefs[REFRESH_TOKEN_KEY] = refreshToken
        }
    }

    override suspend fun clearTokens() {
        cachedAccessToken = null
        cachedRefreshToken = null
        dataStore.edit { prefs ->
            prefs.remove(ACCESS_TOKEN_KEY)
            prefs.remove(REFRESH_TOKEN_KEY)
        }
    }
}
