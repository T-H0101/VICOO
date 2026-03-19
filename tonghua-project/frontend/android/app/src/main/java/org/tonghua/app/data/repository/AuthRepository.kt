package org.tonghua.app.data.repository

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import org.tonghua.app.data.api.ApiResponse
import org.tonghua.app.data.api.TonghuaApi
import org.tonghua.app.data.model.AuthResponse
import org.tonghua.app.data.model.LoginRequest
import org.tonghua.app.data.model.WechatLoginRequest
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for authentication operations.
 *
 * NOTE: Authentication is handled via httpOnly cookies managed by the server.
 * No client-side token storage is needed.
 */
@Singleton
class AuthRepository @Inject constructor(
    private val api: TonghuaApi,
    @ApplicationContext private val context: Context,
) {
    /**
     * Login with email and password.
     * Server sets httpOnly cookies for session management.
     */
    suspend fun login(email: String, password: String): Result<AuthResponse> {
        return try {
            val response = api.login(LoginRequest(email, password))
            if (response.isSuccessful && response.body()?.success == true) {
                // Server sets httpOnly cookies via Set-Cookie header
                Result.success(response.body()!!.data!!)
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
     * Server sets httpOnly cookies for session management.
     */
    suspend fun wechatLogin(code: String): Result<AuthResponse> {
        return try {
            val request = WechatLoginRequest(code = code)
            val response = api.wechatLogin(request)
            if (response.isSuccessful && response.body()?.success == true) {
                // Server sets httpOnly cookies via Set-Cookie header
                Result.success(response.body()!!.data!!)
            } else {
                val error = response.body()?.error?.message ?: "WeChat login failed"
                Result.failure(Exception(error))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Logout - server clears session cookies.
     */
    suspend fun logout(): Result<Unit> {
        return try {
            api.logout()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.success(Unit) // Always succeed even if API fails
        }
    }

    /**
     * Check if user is currently logged in.
     * NOTE: This is a client-side check. For server-side validation,
     * the API will return 401 if the session is invalid.
     *
     * Implementation: Checks for presence of session cookies in SharedPreferences.
     * Cookies are persisted by AndroidCookieJar in the "tonghua_cookies" shared prefs.
     *
     * Note: This does NOT validate cookie expiration with the server.
     * API calls will return 401 if the session is actually expired.
     */
    fun isLoggedIn(): Boolean {
        return try {
            val prefs = context.getSharedPreferences("tonghua_cookies", Context.MODE_PRIVATE)
            val cookies = prefs.getString("stored_cookies", "") ?: ""
            // Check if cookies are present (non-empty string indicates active session)
            cookies.isNotEmpty()
        } catch (e: Exception) {
            false
        }
    }
}
