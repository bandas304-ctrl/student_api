import { useState, useEffect } from "react";
import "./App.css";

import AdminDashboard from "./AdminDashboard";
import Topbar         from "./Topbar";

const BASE_URL = "http://localhost:5000/api";

function gradeClass(score) {
  if (score >= 75) return "grade-high";
  if (score >= 50) return "grade-mid";
  return "grade-low";
}

/* =========================
   AUTH PAGE
========================= */
function AuthPage({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");

  const handleLogin = async () => {
    setError("");
    const res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.message); return; }
    onLogin(data.user);
  };

  const handleSignup = async () => {
    setError("");
    const res = await fetch(`${BASE_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.message); return; }
    alert("Account created. Please login.");
    setIsSignup(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <span className="auth-brand-name">Academix</span>
        </div>
        <div className="auth-hero">
          <h1>Your <em>academic</em> journey starts here.</h1>
          <p>Manage courses, track grades, and stay on top of your progress — all in one place.</p>
        </div>
        <div className="auth-dots">
          <span /><span /><span />
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-wrap">
          <h2>{isSignup ? "Create account" : "Welcome back"}</h2>
          <p className="subtitle">
            {isSignup ? "Join the student portal today." : "Sign in to your student portal."}
          </p>

          {error && <p className="error-msg">{error}</p>}

          <div className="field-group">
            {isSignup && (
              <div className="field">
                <label>Full Name</label>
                <input placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label>Email Address</label>
              <input placeholder="you@university.edu" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          </div>

          <button className="btn-primary" onClick={isSignup ? handleSignup : handleLogin}>
            {isSignup ? "Create Account" : "Sign In"}
          </button>

          <p className="auth-switch">
            {isSignup ? "Already have an account?" : "Don't have an account?"}
            <span onClick={() => { setIsSignup(!isSignup); setError(""); }}>
              {isSignup ? " Sign in" : " Sign up"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================
   STUDENT DASHBOARD
========================= */
function StudentDashboard({ user, onLogout }) {
  const [courses, setCourses] = useState([]);
  const [grades, setGrades]   = useState([]);

  // FIX: Use user.student_id (students table PK) not user.id (users table PK)
  // These are different! e.g. Johnson has user.id=5 but user.student_id=3
  const studentId = user.student_id;

  useEffect(() => {
    loadCourses();
    loadGrades();
  }, []);

  const loadCourses = async () => {
    const res = await fetch(`${BASE_URL}/student-courses/${studentId}`);
    setCourses(await res.json());
  };

  const loadGrades = async () => {
    const res = await fetch(`${BASE_URL}/grades/${studentId}`);
    setGrades(await res.json());
  };

  const submitForApproval = async (id) => {
    const res = await fetch(`${BASE_URL}/submit-course/${id}`, { method: "PUT" });
    if (res.ok) {
      loadCourses();
    }
  };

  // Hide course requests that already have a grade recorded
  const activeRequests = courses.filter(course =>
    !grades.some(grade => grade.course_name === course.name)
  );

  return (
    <div className="app-wrap">
      <Topbar user={user} section="Student Dashboard" onLogout={onLogout} />
      <div className="page">
        <p className="page-title">Hello, {user.name.split(" ")[0]} 👋</p>
        <p className="page-subtitle">Here's an overview of your academic activity.</p>

        <div className="card">
          <div className="card-title"><span className="card-title-dot" />Course Requests</div>
          {activeRequests.length === 0 ? (
            <div className="empty">No active course requests.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Course</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {activeRequests.map(c => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                      <td>
                        {c.status === "pending" && (
                          <button className="btn-approve" onClick={() => submitForApproval(c.id)}>
                            Submit for Approval
                          </button>
                        )}
                        {c.status === "submitted" && (
                          <span className="badge badge-pending">Awaiting admin approval</span>
                        )}
                        {c.status === "rejected" && (
                          <span className="badge badge-rejected">Rejected</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title"><span className="card-title-dot" />Your Grades</div>
          {grades.length === 0 ? (
            <div className="empty">No grades recorded yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Course</th><th>Score</th></tr>
                </thead>
                <tbody>
                  {grades.map(g => (
                    <tr key={g.id}>
                      <td>{g.course_name}</td>
                      <td><span className={`grade-pill ${gradeClass(g.score)}`}>{g.score}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================
   MAIN APP
========================= */
export default function App() {
  const [user, setUser] = useState(null);

  return (
    <>
      {!user ? (
        <AuthPage onLogin={setUser} />
      ) : user.role === "admin" ? (
        <AdminDashboard user={user} onLogout={() => setUser(null)} />
      ) : (
        <StudentDashboard user={user} onLogout={() => setUser(null)} />
      )}
    </>
  );
}