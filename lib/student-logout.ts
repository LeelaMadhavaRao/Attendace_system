/**
 * Client-side utility for clearing student authentication data
 * Clears localStorage, sessionStorage, and cookies
 * 
 * Usage: Call from client components during logout
 */
export function clearStudentAuthData() {
  // Clear localStorage
  localStorage.removeItem("userRole")
  localStorage.removeItem("studentName")
  localStorage.removeItem("registerNumber")
  localStorage.removeItem("studentUsername")
  localStorage.removeItem("studentId")
  localStorage.removeItem("classId")
  localStorage.removeItem("className")

  // Clear sessionStorage
  sessionStorage.removeItem("userRole")
  sessionStorage.removeItem("studentName")
  sessionStorage.removeItem("registerNumber")
  sessionStorage.removeItem("studentUsername")
  sessionStorage.removeItem("studentId")
  sessionStorage.removeItem("classId")
  sessionStorage.removeItem("className")

  // Clear cookies
  document.cookie = "studentAuth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict"

  console.log("[LOGOUT] All student auth data cleared")
}
