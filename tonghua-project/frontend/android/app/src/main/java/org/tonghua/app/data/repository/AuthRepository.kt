package org.tonghua.app.data.repository

import org.tonghua.app.data.api.ApiResponse
import org.tonghua.app.data.api.TonghuaApi
import org.tonghua.app.data.api.TokenProvider
import org.tonghua.app.data.model.AuthResponse
import org.tonghua.app.data.model.LoginRequest
import org.tonghua.app.data.model.RefreshRequest
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for authentication operations.
 */
@Singleton
class AuthRepository @Inject constructor(
    private val api: TonghuaApi,
    private val tokenProvider: TokenProvider,
) {
    /**
     * Login with email and password.
     * Saves tokens on success.
     */
    suspend fun login(email: String, password: String): Result<AuthResponse> {
        return try {
            val response = api.login(LoginRequest(email, password))
            if (response.isSuccessful && response.body()?.success == true) {
                val auth = response.body()!!.data!!
                if (!auth.refreshToken.isNullOrBlank()) {
                    tokenProvider.saveTokens(auth.accessToken, auth.refreshToken)
                }
                Result.success(auth)
            } else {
                val error = response.body()?.error?.message ?: "Login failed"
                Result.failure(Exception(error))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Login with WeChat code.
     */
    suspend fun wechatLogin(code: String): Result<AuthResponse> {
        return try {
            val request = org.tonghua.app.data.model.WechatLoginRequest(code = code)
            val response = api.wechatLogin(request)
            if (response.isSuccessful && response.body()?.success == true) {
                val auth = response.body()!!.data!!
                if (!auth.refreshToken.isNullOrBlank()) {
                    tokenProvider.saveTokens(auth.accessToken, auth.refreshToken)
                }
                Result.success(auth)
            } else {
                val error = response.body()?.error?.message ?: "WeChat login failed"
                Result.failure(Exception(error))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Refresh access token using stored refresh token.
     */
    suspend fun refreshToken(): Result<String> {
        val refreshToken = tokenProvider.getRefreshToken()
            ?: return Result.failure(Exception("No refresh token available"))

        return try {
            val response = api.refreshToken(RefreshRequest(refreshToken))
            if (response.isSuccessful && response.body()?.success == true) {
                val newToken = response.body()!!.data!!.accessToken
                tokenProvider.saveTokens(newToken, refreshToken)
                Result.success(newToken)
            } else {
                tokenProvider.clearTokens()
                Result.failure(Exception("Token refresh failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Logout and clear tokens.
     */
    suspend fun logout(): Result<Unit> {
        return try {
            api.logout()
            tokenProvider.clearTokens()
            Result.success(Unit)
        } catch (e: Exception) {
            tokenProvider.clearTokens()
            Result.success(Unit) // Always clear local tokens even if API fails
        }
    }

    /**
     * Check if user is currently logged in.
     */
    fun isLoggedIn(): Boolean {
        return tokenProvider.getAccessToken() != null
    }
}
