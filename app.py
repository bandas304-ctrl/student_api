from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

db_config = {
    "host": "localhost",
    "user": "root",
    "password": "1234",
    "database": "student_api"
}

def get_db_connection():
    return mysql.connector.connect(**db_config)

# -----------------------------
# Auth & User Routes
# -----------------------------

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    conn = get_db_connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        query = """SELECT u.id, u.name, u.email, u.role, s.id AS student_id FROM users u LEFT JOIN students s ON s.user_id = u.id WHERE u.email=%s AND u.password_hash=%s"""
        cursor.execute(query, (data.get("email"), data.get("password")))
        user = cursor.fetchone()
        if user:
            return jsonify({"user": user})
        return jsonify({"message": "Invalid credentials"}), 401
    except Exception as e:
        return jsonify({"message": "Server Error", "error": str(e)}), 500
    finally:
        if cursor: cursor.close()
        conn.close()

@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.json
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user_query = "INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, %s)"
        cursor.execute(user_query, (name, email, password, 'student'))
        new_user_id = cursor.lastrowid

        student_number = f"STU-{new_user_id:03d}"
        student_query = """
            INSERT INTO students (user_id, student_number, year_of_study, program) 
            VALUES (%s, %s, %s, %s)
        """
        cursor.execute(student_query, (new_user_id, student_number, 1, 'Undeclared'))
        conn.commit()
        return jsonify({"message": "Account created successfully"}), 201
    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        return jsonify({"message": "Email already exists or database error"}), 400
    finally:
        cursor.close()
        conn.close()

# -----------------------------
# Admin Data Retrieval
# -----------------------------

@app.route("/api/courses", methods=["GET"])
def get_courses():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, code, name, credits FROM courses ORDER BY name")
        data = cursor.fetchall()
        return jsonify(data)
    except Exception as e:
        print(f"Error fetching courses: {e}")
        return jsonify([]), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/students", methods=["GET"])
def get_students():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        query = """
        SELECT 
            s.id AS id, 
            u.name, 
            u.email,
            s.student_number
        FROM students s
        JOIN users u ON s.user_id = u.id
        WHERE u.role = 'student'
        ORDER BY u.name
        """
        cursor.execute(query)
        data = cursor.fetchall()
        return jsonify(data)
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# -----------------------------
# Course Assignment & Filtering
# -----------------------------

@app.route("/api/assign-course", methods=["POST"])
def assign_course():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = "INSERT INTO course_requests (student_id, course_id, status) VALUES (%s, %s, 'pending')"
        cursor.execute(query, (data.get("student_id"), data.get("course_id")))
        conn.commit()
        return jsonify({"message": "Course assigned successfully"})
    finally:
        cursor.close()
        conn.close()

@app.route("/api/all-approved-requests")
def all_requests():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Double safety: filter by is_graded=0 AND no matching row in grades table
        query = """
        SELECT 
            r.id, 
            s.id AS student_id, 
            c.id AS course_id, 
            u.name AS student_name, 
            c.code AS course_code, 
            r.is_graded
        FROM course_requests r
        JOIN students s ON r.student_id = s.id
        JOIN users u ON s.user_id = u.id
        JOIN courses c ON r.course_id = c.id
        LEFT JOIN grades g ON g.student_id = s.id AND g.course_id = c.id
        WHERE r.status = 'approved' 
          AND r.is_graded = 0
          AND g.id IS NULL
        """
        cursor.execute(query)
        data = cursor.fetchall()
        print(f"DEBUG /all-approved-requests: returned {len(data)} rows")
        return jsonify(data)
    except Exception as e:
        print(f"Error in all_requests: {e}")
        return jsonify([]), 500
    finally:
        cursor.close()
        conn.close()


@app.route("/api/submit-course/<int:id>", methods=["PUT"])
def submit_course(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Only allow submitting if currently pending (assigned by admin, not yet submitted)
        cursor.execute(
            "UPDATE course_requests SET status='submitted' WHERE id=%s AND status='pending'",
            (id,)
        )
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"message": "Course not found or already submitted"}), 400
        return jsonify({"message": "Course submitted for approval"})
    except Exception as e:
        print(f"Error submitting course: {e}")
        return jsonify({"message": "Server error"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/all-pending-requests")
def all_pending_requests():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        query = """
        SELECT 
            r.id, 
            s.id AS student_id, 
            c.id AS course_id, 
            u.name AS student_name, 
            c.code AS course_code
        FROM course_requests r
        JOIN students s ON r.student_id = s.id
        JOIN users u ON s.user_id = u.id
        JOIN courses c ON r.course_id = c.id
        WHERE r.status = 'submitted'
        ORDER BY r.created_at DESC
        """
        cursor.execute(query)
        data = cursor.fetchall()
        return jsonify(data)
    except Exception as e:
        print(f"Error in all_pending_requests: {e}")
        return jsonify([]), 500
    finally:
        cursor.close()
        conn.close()


# -----------------------------
# Grade Management
# -----------------------------

@app.route("/api/grades", methods=["POST"])
def add_grade():
    data = request.json
    student_id = data.get('student_id')
    course_id = data.get('course_id')
    score = data.get('score')
    grade_letter = data.get('grade_letter')
    semester = data.get('semester')

    print(f"DEBUG add_grade: student_id={student_id}, course_id={course_id}, score={score}, grade={grade_letter}, semester={semester}")

    # FIX: use 'is None' so a score of 0 is treated as valid
    if any(v is None for v in [student_id, course_id, score, grade_letter, semester]):
        print("DEBUG: Missing required field — returning 400")
        return jsonify({"message": "Missing required grade data"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Insert the grade record
        insert_query = """
            INSERT INTO grades (student_id, course_id, score, grade_letter, semester)
            VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(insert_query, (student_id, course_id, score, grade_letter, semester))
        print(f"DEBUG: Grade row inserted.")

        # 2. FIX: Mark is_graded=1 with LIMIT 1 to avoid ambiguity if duplicates exist
        update_query = """
            UPDATE course_requests 
            SET is_graded = 1 
            WHERE student_id = %s 
              AND course_id = %s 
              AND status = 'approved'
              AND is_graded = 0
            LIMIT 1
        """
        cursor.execute(update_query, (student_id, course_id))
        rows_updated = cursor.rowcount
        print(f"DEBUG: course_requests rows marked graded: {rows_updated}")

        if rows_updated == 0:
            print(f"WARNING: No ungraded approved request found for Student:{student_id} Course:{course_id}")

        conn.commit()
        return jsonify({"message": "Grade submitted successfully!"}), 201

    except mysql.connector.Error as err:
        conn.rollback()
        if err.errno == 1062:
            return jsonify({"message": "This student already has a grade for this course this semester."}), 409
        print(f"DATABASE ERROR: {err}")
        return jsonify({"message": "Database error occurred"}), 500
    finally:
        cursor.close()
        conn.close()

# -----------------------------
# Student Dashboard Logic
# -----------------------------

@app.route("/api/grades/<int:student_id>", methods=["GET"])
def get_student_grades(student_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        query = """
        SELECT 
            g.id,
            c.name AS course_name,
            c.code AS course_code,
            g.score,
            g.grade_letter,
            g.semester
        FROM grades g
        JOIN courses c ON g.course_id = c.id
        WHERE g.student_id = %s
        ORDER BY g.semester, c.name
        """
        cursor.execute(query, (student_id,))
        data = cursor.fetchall()
        print(f"DEBUG /api/grades/{student_id}: returned {len(data)} grades")
        return jsonify(data)
    except Exception as e:
        print(f"Error fetching grades for student {student_id}: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/student-courses/<int:student_id>", methods=["GET"])
def get_student_courses(student_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        query = """
        SELECT cr.id, c.name, c.code, cr.status
        FROM course_requests cr
        JOIN courses c ON c.id = cr.course_id
        LEFT JOIN grades g ON cr.student_id = g.student_id AND cr.course_id = g.course_id
        WHERE cr.student_id=%s 
          AND g.id IS NULL
          AND cr.status IN ('pending', 'submitted', 'approved')
        """
        cursor.execute(query, (student_id,))
        return jsonify(cursor.fetchall())
    finally:
        cursor.close()
        conn.close()

@app.route("/api/approve-course/<int:id>", methods=["PUT"])
def approve_course(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE course_requests SET status='approved' WHERE id=%s", (id,))
        conn.commit()
        return jsonify({"message": "Course approved"})
    finally:
        cursor.close()
        conn.close()

@app.route("/api/reject-course/<int:id>", methods=["PUT"])
def reject_course(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE course_requests SET status='rejected' WHERE id=%s", (id,))
        conn.commit()
        return jsonify({"message": "Course rejected"})
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    app.run(debug=True, port=5000)