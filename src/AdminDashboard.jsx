import { useState, useEffect } from "react";
import Topbar from "./Topbar";

const BASE_URL = "http://localhost:5000/api";

export default function AdminDashboard({ user, onLogout }) {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);   // NEW: pending approval
  const [approvedRequests, setApprovedRequests] = useState([]); // existing: pending grades

  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");

  const [scores, setScores] = useState({});
  const [semester, setSemester] = useState("2025 Semester 1");

  const [loading, setLoading] = useState(true);
  const [assignMsg, setAssignMsg] = useState(null);
  const [gradeMsg, setGradeMsg] = useState(null);
  const [approvalMsg, setApprovalMsg] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, cRes, aRes, pRes] = await Promise.all([
        fetch(`${BASE_URL}/students`),
        fetch(`${BASE_URL}/courses`),
        fetch(`${BASE_URL}/all-approved-requests`),
        fetch(`${BASE_URL}/all-pending-requests`),   // NEW endpoint
      ]);

      setStudents(await sRes.json());
      setCourses(await cRes.json());

      const approvedData = await aRes.json();
      setApprovedRequests(approvedData.filter(req => !req.is_graded));

      setPendingRequests(await pRes.json());

    } catch (err) {
      console.error("Failed to load admin data", err);
    }
    setLoading(false);
  };

  const getGradeLetter = (score) => {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  };

  const assignCourse = async () => {
    if (!studentId || !courseId) {
      setAssignMsg({ type: "error", text: "Please select both a student and a course." });
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}/assign-course`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: parseInt(studentId),
          course_id: parseInt(courseId)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAssignMsg({ type: "success", text: "Course assigned. Student must now submit it for approval." });
        setStudentId("");
        setCourseId("");
        loadData();
      } else {
        setAssignMsg({ type: "error", text: data.message || "Assignment failed." });
      }
    } catch (err) {
      setAssignMsg({ type: "error", text: "Server connection failed." });
    }
    setTimeout(() => setAssignMsg(null), 4000);
  };

  // NEW: Admin approves a pending course request
  const approveCourse = async (id) => {
    try {
      const res = await fetch(`${BASE_URL}/approve-course/${id}`, { method: "PUT" });
      if (res.ok) {
        setApprovalMsg({ type: "success", text: "Course approved." });
        loadData();
      }
    } catch (err) {
      setApprovalMsg({ type: "error", text: "Server connection failed." });
    }
    setTimeout(() => setApprovalMsg(null), 3000);
  };

  // NEW: Admin rejects a pending course request
  const rejectCourse = async (id) => {
    try {
      const res = await fetch(`${BASE_URL}/reject-course/${id}`, { method: "PUT" });
      if (res.ok) {
        setApprovalMsg({ type: "success", text: "Course rejected." });
        loadData();
      }
    } catch (err) {
      setApprovalMsg({ type: "error", text: "Server connection failed." });
    }
    setTimeout(() => setApprovalMsg(null), 3000);
  };

  const submitGrade = async (sId, cId, requestId) => {
    const score = Number(scores[requestId]);
    if (scores[requestId] === "" || scores[requestId] === undefined || isNaN(score) || score < 0 || score > 100) {
      alert("Please enter a valid score (0-100).");
      return;
    }
    const gradeLetter = getGradeLetter(score);
    try {
      const res = await fetch(`${BASE_URL}/grades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: sId,
          course_id: cId,
          score: score,
          grade_letter: gradeLetter,
          semester: semester
        })
      });
      if (res.ok) {
        setGradeMsg({ type: "success", text: "Grade added successfully!" });
        setApprovedRequests(prev => prev.filter(req => req.id !== requestId));
        setScores(prev => {
          const updated = { ...prev };
          delete updated[requestId];
          return updated;
        });
      } else {
        const data = await res.json();
        setGradeMsg({ type: "error", text: data.message || "Failed to add grade." });
      }
    } catch (err) {
      setGradeMsg({ type: "error", text: "Server connection failed." });
    }
    setTimeout(() => setGradeMsg(null), 3000);
  };

  if (loading) {
    return <div className="page"><div className="empty">Loading Dashboard...</div></div>;
  }

  return (
    <div className="app-wrap">
      <Topbar user={user} section="Admin Dashboard" onLogout={onLogout} />

      <main className="page">
        <h1 className="page-title">Admin Dashboard</h1>

        {/* SECTION: ASSIGN COURSE */}
        <div className="card">
          <div className="card-title"><span className="card-title-dot" />Assign New Course</div>
          {assignMsg && <div className={`assign-msg assign-msg-${assignMsg.type}`}>{assignMsg.text}</div>}
          <div className="assign-grid">
            <div className="field">
              <label>Select Student</label>
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">Choose...</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.student_number})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Select Course</label>
              <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Choose...</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <button className="btn-assign" onClick={assignCourse}>Assign Course</button>
          </div>
        </div>

        {/* SECTION: PENDING APPROVALS (NEW) */}
        <div className="card">
          <div className="card-title">
            <span className="card-title-dot" style={{ backgroundColor: '#9b59b6' }} />
            Course Approval Requests
          </div>
          {approvalMsg && <div className={`assign-msg assign-msg-${approvalMsg.type}`}>{approvalMsg.text}</div>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Course Code</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.length === 0 ? (
                  <tr><td colSpan="3" className="empty">No courses submitted for approval.</td></tr>
                ) : (
                  pendingRequests.map(req => (
                    <tr key={req.id}>
                      <td><span className="user-name">{req.student_name}</span></td>
                      <td><span className="code-cell">{req.course_code}</span></td>
                      <td>
                        <div className="action-group">
                          <button className="btn-approve" onClick={() => approveCourse(req.id)}>Approve</button>
                          <button className="btn-reject" onClick={() => rejectCourse(req.id)}>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION: PENDING GRADES */}
        <div className="card">
          <div className="card-title">
            <span className="card-title-dot" style={{ backgroundColor: '#e67e22' }} />
            Pending Grades
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label>Semester </label>
            <select className="field select" value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option>2025 Semester 1</option>
              <option>2025 Semester 2</option>
              <option>2026 Semester 1</option>
            </select>
          </div>
          {gradeMsg && <div className={`assign-msg assign-msg-${gradeMsg.type}`}>{gradeMsg.text}</div>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Course Code</th>
                  <th>Score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {approvedRequests.length === 0 ? (
                  <tr><td colSpan="4" className="empty">No pending grades.</td></tr>
                ) : (
                  approvedRequests.map(req => (
                    <tr key={req.id}>
                      <td><span className="user-name">{req.student_name}</span></td>
                      <td><span className="code-cell">{req.course_code}</span></td>
                      <td>
                        <input
                          type="number"
                          className="field input"
                          style={{ width: "80px" }}
                          value={scores[req.id] ?? ""}
                          onChange={(e) => setScores({ ...scores, [req.id]: Number(e.target.value) })}
                          placeholder="0-100"
                          min="0"
                          max="100"
                        />
                      </td>
                      <td>
                        <button className="btn-primary" onClick={() => submitGrade(req.student_id, req.course_id, req.id)}>
                          Submit Grade
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION: STUDENT DIRECTORY */}
        <div className="card">
          <div className="card-title">
            <span className="card-title-dot" style={{ backgroundColor: '#2ecc71' }} />
            Student Directory
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>ID</th><th>Name</th><th>Email</th><th>Student Number</th></tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td>#{s.id}</td>
                    <td>{s.name}</td>
                    <td>{s.email}</td>
                    <td>{s.student_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}