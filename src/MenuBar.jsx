// MenuBar.jsx
function MenuBar() {
  return (
    <nav style={{
      backgroundColor: "#000",
      color: "white",
      padding: "12px 24px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: "1px solid #333"
    }}>
      {/* Left - App Name */}
      <div style={{ fontWeight: "bold", fontSize: "1.2rem" }}>
        My App
      </div>

      {/* Right - Menu Links */}
      <div style={{ display: "flex", gap: "20px" }}>
        <a href="#" style={{ color: "white", textDecoration: "none" }}>Home</a>
        <a href="#" style={{ color: "white", textDecoration: "none" }}>Features</a>
        <a href="#" style={{ color: "white", textDecoration: "none" }}>About</a>
        <a href="#" style={{ color: "white", textDecoration: "none" }}>Contact</a>
      </div>
    </nav>
  );
}

export default MenuBar;
