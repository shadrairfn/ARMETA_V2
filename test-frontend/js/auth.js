// Auth Helper Functions
const API_URL = "http://localhost:3000";

// Check if user is authenticated
function isAuthenticated() {
	return !!localStorage.getItem("accessToken");
}

// Get current user from localStorage
function getCurrentUser() {
	const userStr = localStorage.getItem("user");
	return userStr ? JSON.parse(userStr) : null;
}

// Get access token
function getAccessToken() {
	return localStorage.getItem("accessToken");
}

// Get refresh token
function getRefreshToken() {
	return localStorage.getItem("refreshToken");
}

// Logout user
async function logout() {
	try {
		const token = getAccessToken();
		if (token) {
			await fetch(`${API_URL}/api/users/logout`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
		}
	} catch (error) {
		console.error("Logout error:", error);
	} finally {
		localStorage.clear();
		window.location.href = "login.html";
	}
}

// Refresh access token
async function refreshAccessToken() {
	const refreshToken = getRefreshToken();
	if (!refreshToken) {
		throw new Error("No refresh token");
	}

	try {
		const response = await fetch(`${API_URL}/api/users/refresh-token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ refreshToken }),
		});

		if (response.ok) {
			const data = await response.json();
			localStorage.setItem("accessToken", data.data.accessToken);
			return data.data.accessToken;
		} else {
			throw new Error("Failed to refresh token");
		}
	} catch (error) {
		console.error("Refresh token error:", error);
		logout();
		throw error;
	}
}

// Make authenticated API request with auto token refresh
async function authFetch(url, options = {}) {
	const token = getAccessToken();

	// Add authorization header
	const authOptions = {
		...options,
		headers: {
			...options.headers,
			Authorization: `Bearer ${token}`,
		},
	};

	let response = await fetch(url, authOptions);

	// If unauthorized, try to refresh token
	if (response.status === 401 || response.status === 403) {
		try {
			const newToken = await refreshAccessToken();

			// Retry with new token
			authOptions.headers.Authorization = `Bearer ${newToken}`;
			response = await fetch(url, authOptions);
		} catch (error) {
			logout();
			throw error;
		}
	}

	return response;
}

// Parse query parameters (for OAuth callback)
function getQueryParams() {
	const params = {};
	const queryString = window.location.search.substring(1);
	const pairs = queryString.split("&");

	for (const pair of pairs) {
		const [key, value] = pair.split("=");
		if (key) {
			params[decodeURIComponent(key)] = decodeURIComponent(value || "");
		}
	}

	return params;
}

// Export functions for use in other files
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		isAuthenticated,
		getCurrentUser,
		getAccessToken,
		getRefreshToken,
		logout,
		refreshAccessToken,
		authFetch,
		getQueryParams,
	};
}
