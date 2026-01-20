import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
);

export default function Pro({
  themes = [],
  themeIndex = 0,
  onThemeChange = () => {},
}) {
  const COLORS = themes[themeIndex] || {};
  const [isProUser, setIsProUser] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Check authentication status and pro status on mount
  useEffect(() => {
    checkProStatus();
  }, []);

  async function checkProStatus() {
    try {
      // Check if user has a session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setIsLoggedIn(true);

        // Fetch is_pro_user from profiles table
        const { data, error } = await supabase
          .from("profiles")
          .select("is_pro_user")
          .eq("id", session.user.id)
          .single();

        if (error) {
          console.error("Error fetching pro status:", error);
          return;
        }

        setIsProUser(data?.is_pro_user || false);
      }
    } catch (error) {
      console.error("Error checking pro status:", error);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setLoginError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setIsLoggedIn(true);
      setShowLogin(false);

      // Check pro status after login
      await checkProStatus();

      setEmail("");
      setPassword("");
    } catch (error) {
      setLoginError(error.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Handle theme selection
  function handleThemeSelect(index) {
    localStorage.setItem("eqThemeIndex", JSON.stringify(index));
    onThemeChange(index);
  }

  // Render color picker circle with 45-degree split
  function renderThemeCircle(index, theme) {
    const bgColor = theme.BACKGROUND;
    const textColor = theme.TEXT;
    const isSelected = index === themeIndex;
    // Enable all themes if user is pro, otherwise disable themes 2-6
    const isDisabled = !isProUser && index >= 2 && index <= 6;

    return (
      <button
        key={`theme-${index}`}
        onClick={() => !isDisabled && handleThemeSelect(index)}
        disabled={isDisabled}
        className={`relative w-6 h-6 rounded-full transition-transform flex items-center justify-center ${
          isDisabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:scale-110"
        }`}
        style={{
          border: isSelected
            ? `3px solid ${COLORS.POINT}`
            : `3px solid ${COLORS.TEXT}b3`,
          boxShadow: isSelected ? `0 0 8px ${COLORS.POINT}` : "none",
        }}
      >
        {/* SVG with 45-degree diagonal split (mirrored vertically) */}
        <svg
          viewBox="0 0 100 100"
          className="w-[75%] h-[75%] rounded-full"
          style={{ overflow: "visible" }}
        >
          {/* Top-left semicircle (text color) - 45 degree split */}
          <path d="M 100 0 A 50 50 0 0 1 0 100 Z" fill={textColor} />
          {/* Bottom-right semicircle (background color) - mirrored 45 degree split */}
          <path d="M 100 0 A 50 50 0 0 0 0 100 Z" fill={bgColor} />
        </svg>
      </button>
    );
  }

  return (
    <div
      className="w-[730px] h-[365px] ml-13 relative flex items-center justify-center border"
      style={{ borderColor: COLORS.TEXT }}
    >
      {/* Top Left Auth Buttons */}
      {!isLoggedIn && (
        <div className="absolute top-4 left-4 flex gap-2">
          {showLogin ? (
            <form onSubmit={handleLogin} className="flex gap-2">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="p-1 rounded text-xs"
                style={{
                  backgroundColor: COLORS.BACKGROUND,
                  color: COLORS.TEXT,
                  border: `1px solid ${COLORS.TEXT}66`,
                }}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="p-1 rounded text-xs"
                style={{
                  backgroundColor: COLORS.BACKGROUND,
                  color: COLORS.TEXT,
                  border: `1px solid ${COLORS.TEXT}66`,
                }}
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="py-1 px-3 rounded text-xs font-semibold transition cursor-pointer hover:opacity-90"
                style={{
                  backgroundColor: loading ? COLORS.TEXT + "66" : COLORS.POINT,
                  color: COLORS.BACKGROUND,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Loading..." : "Login"}
              </button>
              <button
                type="button"
                onClick={() => setShowLogin(false)}
                className="py-1 px-3 rounded text-xs cursor-pointer hover:opacity-90"
                style={{
                  backgroundColor: COLORS.TEXT + "22",
                  color: COLORS.TEXT,
                }}
              >
                Cancel
              </button>
              {loginError && (
                <p
                  className="text-xs font-semibold"
                  style={{ color: "#ff4444" }}
                >
                  {loginError}
                </p>
              )}
            </form>
          ) : (
            <>
              <button
                onClick={() => setShowLogin(true)}
                className="py-1 px-4 rounded text-xs font-semibold transition hover:opacity-90 cursor-pointer"
                style={{
                  backgroundColor: COLORS.POINT,
                  color: COLORS.BACKGROUND,
                }}
              >
                Login
              </button>
              <a
                href="https://ears-audio-system.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="py-1 px-4 rounded text-xs font-semibold transition hover:opacity-90 cursor-pointer"
                style={{
                  backgroundColor: COLORS.TEXT + "22",
                  color: COLORS.TEXT,
                  textDecoration: "none",
                }}
              >
                Get Airs Pro
              </a>
            </>
          )}
        </div>
      )}

      <div className="text-center w-full px-8" style={{ color: COLORS.TEXT }}>
        <h2 className="text-2xl font-bold mb-6">Airs Pro</h2>

        {/* Theme Color Picker */}
        <div className="mb-6">
          <p className="text-base mb-4 font-semibold">Select Theme:</p>
          <div className="flex gap-4 justify-center flex-wrap">
            {themes.map((theme, index) => renderThemeCircle(index, theme))}
          </div>
        </div>

        {/* Pro Status Message */}
        {isLoggedIn && (
          <div className="mb-4">
            <p className="text-sm" style={{ color: COLORS.TEXT }}>
              <i>Pro Account Active - More themes to come!</i>
            </p>
          </div>
        )}
        {!isLoggedIn && (
          <p className="text-sm">
            <i>Upgrade to unlock premium themes.</i>
          </p>
        )}
      </div>
    </div>
  );
}
