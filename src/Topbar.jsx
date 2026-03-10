import BookIcon from "./BookIcon";

function getInitials(name = "") {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function Topbar({ user, section, onLogout }) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-logo"><BookIcon /></div>
        <span className="topbar-name">Academix</span>
        <div className="topbar-divider" />
        <span className="topbar-section">{section}</span>
      </div>
      <div className="topbar-right">
        <div className="avatar">{getInitials(user.name)}</div>
        <span className="user-name">{user.name}</span>
        <button className="btn-logout" onClick={onLogout}>Sign out</button>
      </div>
    </div>
  );
}
