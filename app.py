from flask import Flask, render_template, request, redirect, url_for, session, Response, jsonify, flash
import os
import cv2
import numpy as np
import mediapipe as mp
from werkzeug.utils import secure_filename
import base64
import threading
import time
import math
import pyttsx3
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user

app = Flask(__name__)
app.secret_key = 'your_super_secret_key_here'
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Flask-Login setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Global variables for camera stream
camera = None
is_camera_running = False
output_frame = None
lock = threading.Lock()
current_gesture = "No hand detected"
last_speech_time = 0
speech_cooldown = 1.5  # seconds between spoken outputs to avoid constant repetition

# Initialize TTS engine and lock
tts_engine = None
tts_lock = threading.Lock()

speaker_enabled = True  # Default state: speaker is enabled

def init_tts():
    global tts_engine
    try:
        tts_engine = pyttsx3.init()
        tts_engine.setProperty('rate', 150)
        tts_engine.setProperty('volume', 0.9)
    except Exception as e:
        print(f"Error initializing TTS engine: {str(e)}")

init_tts()

# User model
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# Create tables
with app.app_context():
    db.create_all()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Setup MediaPipe
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles
mp_hands = mp.solutions.hands

class HandGestureRecognizer:
    def __init__(self):
        self.hands = mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.6,  # Lowered for better detection
            min_tracking_confidence=0.5
        )
        self.initialize_asl_patterns()
        self.last_gesture = None
    
    def close(self):
        self.hands.close()
    
    def initialize_asl_patterns(self):
        self.asl_patterns = {
            'A': {'thumb': True, 'index': False, 'middle': False, 'ring': False, 'pinky': False, 
                 'thumb_position': 'side', 'fingers_folded': True},
            'B': {'thumb': False, 'index': True, 'middle': True, 'ring': True, 'pinky': True, 
                 'palm_facing': 'forward', 'fingers_together': True},
            'C': {'thumb': True, 'index': True, 'middle': True, 'ring': True, 'pinky': True, 
                 'c_shape': True},
            'D': {'thumb': True, 'index': True, 'middle': False, 'ring': False, 'pinky': False,
                 'index_straight': True},
            'E': {'thumb': True, 'index': False, 'middle': False, 'ring': False, 'pinky': False,
                 'fingers_curled': True},
            'F': {'thumb': True, 'index': False, 'middle': True, 'ring': True, 'pinky': True,
                 'index_thumb_connect': True},
            'G': {'thumb': True, 'index': True, 'middle': False, 'ring': False, 'pinky': False,
                 'thumb_index_extended': True, 'hand_orientation': 'horizontal'},
            'H': {'thumb': True, 'index': True, 'middle': True, 'ring': False, 'pinky': False,
                 'index_middle_extended': True},
            'I': {'thumb': False, 'index': False, 'middle': False, 'ring': False, 'pinky': True,
                 'pinky_only': True},
            'J': {'thumb': False, 'index': False, 'middle': False, 'ring': False, 'pinky': True,
                 'j_motion': True},
            'K': {'thumb': True, 'index': True, 'middle': True, 'ring': False, 'pinky': False,
                 'v_shape_up': True},
            'L': {'thumb': True, 'index': True, 'middle': False, 'ring': False, 'pinky': False,
                 'l_shape': True},
            'M': {'thumb': False, 'index': False, 'middle': False, 'ring': False, 'pinky': False,
                 'thumb_between_fingers': True},
            'N': {'thumb': False, 'index': False, 'middle': False, 'ring': False, 'pinky': False,
                 'thumb_between_index_middle': True},
            'O': {'thumb': True, 'index': True, 'middle': True, 'ring': True, 'pinky': True,
                 'o_shape': True},
            'P': {'thumb': True, 'index': True, 'middle': False, 'ring': False, 'pinky': False,
                 'p_shape': True},
            'Q': {'thumb': True, 'index': True, 'middle': False, 'ring': False, 'pinky': False,
                 'q_shape': True},
            'R': {'thumb': True, 'index': True, 'middle': True, 'ring': False, 'pinky': False,
                 'r_shape': True, 'fingers_crossed': True},
            'S': {'thumb': True, 'index': False, 'middle': False, 'ring': False, 'pinky': False,
                 'fist': True},
            'T': {'thumb': True, 'index': False, 'middle': False, 'ring': False, 'pinky': False,
                 'thumb_between_index_middle': True},
            'U': {'thumb': True, 'index': True, 'middle': True, 'ring': False, 'pinky': False,
                 'u_shape': True},
            'V': {'thumb': False, 'index': True, 'middle': True, 'ring': False, 'pinky': False,
                 'v_shape': True},
            'W': {'thumb': False, 'index': True, 'middle': True, 'ring': True, 'pinky': False,
                 'w_shape': True},
            'X': {'thumb': False, 'index': True, 'middle': False, 'ring': False, 'pinky': False,
                 'index_bent': True},
            'Y': {'thumb': True, 'index': False, 'middle': False, 'ring': False, 'pinky': True,
                 'y_shape': True},
            'Z': {'thumb': True, 'index': True, 'middle': False, 'ring': False, 'pinky': False,
                 'z_motion': True},
        }
    
    def get_finger_states(self, hand_landmarks):
        def is_finger_extended(landmarks, tip_index, pip_index, mcp_index):
            tip = landmarks.landmark[tip_index]
            pip = landmarks.landmark[pip_index]
            mcp = landmarks.landmark[mcp_index]
            return (tip.y < pip.y < mcp.y)
        
        # Calculate extended or bent state for each finger
        thumb_extended = hand_landmarks.landmark[mp_hands.HandLandmark.THUMB_TIP].x < hand_landmarks.landmark[mp_hands.HandLandmark.THUMB_MCP].x
        index_extended = is_finger_extended(hand_landmarks, 
            mp_hands.HandLandmark.INDEX_FINGER_TIP,
            mp_hands.HandLandmark.INDEX_FINGER_PIP,
            mp_hands.HandLandmark.INDEX_FINGER_MCP
        )
        middle_extended = is_finger_extended(hand_landmarks, 
            mp_hands.HandLandmark.MIDDLE_FINGER_TIP,
            mp_hands.HandLandmark.MIDDLE_FINGER_PIP,
            mp_hands.HandLandmark.MIDDLE_FINGER_MCP
        )
        ring_extended = is_finger_extended(hand_landmarks, 
            mp_hands.HandLandmark.RING_FINGER_TIP,
            mp_hands.HandLandmark.RING_FINGER_PIP,
            mp_hands.HandLandmark.RING_FINGER_MCP
        )
        pinky_extended = is_finger_extended(hand_landmarks, 
            mp_hands.HandLandmark.PINKY_TIP,
            mp_hands.HandLandmark.PINKY_PIP,
            mp_hands.HandLandmark.PINKY_MCP
        )

        # Calculate additional geometric features for ASL recognition
        landmarks = hand_landmarks.landmark
        
        # Calculate the angle between fingers
        index_middle_angle = self.calculate_angle(
            landmarks[mp_hands.HandLandmark.INDEX_FINGER_TIP],
            landmarks[mp_hands.HandLandmark.WRIST],
            landmarks[mp_hands.HandLandmark.MIDDLE_FINGER_TIP]
        )
        
        # Distance between fingertips
        index_middle_distance = self.calculate_distance(
            landmarks[mp_hands.HandLandmark.INDEX_FINGER_TIP],
            landmarks[mp_hands.HandLandmark.MIDDLE_FINGER_TIP]
        )
        
        thumb_index_distance = self.calculate_distance(
            landmarks[mp_hands.HandLandmark.THUMB_TIP],
            landmarks[mp_hands.HandLandmark.INDEX_FINGER_TIP]
        )
        
        # Check if fingers are curled
        index_curled = self.is_finger_curled(
            landmarks[mp_hands.HandLandmark.INDEX_FINGER_TIP],
            landmarks[mp_hands.HandLandmark.INDEX_FINGER_PIP],
            landmarks[mp_hands.HandLandmark.INDEX_FINGER_MCP]
        )
        
        middle_curled = self.is_finger_curled(
            landmarks[mp_hands.HandLandmark.MIDDLE_FINGER_TIP],
            landmarks[mp_hands.HandLandmark.MIDDLE_FINGER_PIP],
            landmarks[mp_hands.HandLandmark.MIDDLE_FINGER_MCP]
        )
        
        # Basic finger states
        finger_states = {
            'thumb': thumb_extended,
            'index': index_extended,
            'middle': middle_extended,
            'ring': ring_extended,
            'pinky': pinky_extended,
            
            # Additional features for ASL recognition
            'index_middle_angle': index_middle_angle,
            'index_middle_distance': index_middle_distance,
            'thumb_index_distance': thumb_index_distance,
            'index_curled': index_curled,
            'middle_curled': middle_curled,
            
            # Shape-specific features
            'l_shape': thumb_extended and index_extended and not middle_extended and not ring_extended and not pinky_extended,
            'v_shape': not thumb_extended and index_extended and middle_extended and not ring_extended and not pinky_extended,
            'y_shape': thumb_extended and not index_extended and not middle_extended and not ring_extended and pinky_extended,
            'c_shape': self.is_c_shape(landmarks),
            'o_shape': self.is_o_shape(landmarks),
            'fist': not index_extended and not middle_extended and not ring_extended and not pinky_extended
        }

        return finger_states
    
    def calculate_distance(self, point1, point2):
        return math.sqrt((point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2 + (point1.z - point2.z) ** 2)
    
    def calculate_angle(self, point1, point2, point3):
        # Calculate vectors
        v1 = [point1.x - point2.x, point1.y - point2.y, point1.z - point2.z]
        v2 = [point3.x - point2.x, point3.y - point2.y, point3.z - point2.z]
        
        # Calculate dot product
        dot_product = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]
        
        # Calculate magnitudes
        mag1 = math.sqrt(v1[0] ** 2 + v1[1] ** 2 + v1[2] ** 2)
        mag2 = math.sqrt(v2[0] ** 2 + v2[1] ** 2 + v2[2] ** 2)
        
        # Calculate angle in radians and convert to degrees
        try:
            angle = math.acos(dot_product / (mag1 * mag2)) * 180 / math.pi
            return angle
        except:
            return 0
    
    def is_finger_curled(self, tip, pip, mcp):
        # Check if a finger is curled by comparing the relative positions
        return tip.y > pip.y and pip.y > mcp.y
    
    def is_c_shape(self, landmarks):
        # Simplified C-shape detection
        thumb_tip = landmarks[mp_hands.HandLandmark.THUMB_TIP]
        index_tip = landmarks[mp_hands.HandLandmark.INDEX_FINGER_TIP]
        pinky_tip = landmarks[mp_hands.HandLandmark.PINKY_TIP]
        
        distance_thumb_pinky = self.calculate_distance(thumb_tip, pinky_tip)
        wrist = landmarks[mp_hands.HandLandmark.WRIST]
        
        return 0.1 < distance_thumb_pinky < 0.3 and all(
            self.is_finger_curled(landmarks[i], landmarks[i-1], landmarks[i-2]) 
            for i in [mp_hands.HandLandmark.INDEX_FINGER_TIP, 
                     mp_hands.HandLandmark.MIDDLE_FINGER_TIP,
                     mp_hands.HandLandmark.RING_FINGER_TIP, 
                     mp_hands.HandLandmark.PINKY_TIP])
    
    def is_o_shape(self, landmarks):
        thumb_tip = landmarks[mp_hands.HandLandmark.THUMB_TIP]
        index_tip = landmarks[mp_hands.HandLandmark.INDEX_FINGER_TIP]
        distance = self.calculate_distance(thumb_tip, index_tip)
        return distance < 0.1
    
    def detect_gesture(self, finger_states):
        """
        Detects gestures based on finger states.
        """
        # Get finger states
        thumb = finger_states.get('thumb', False)
        index = finger_states.get('index', False)
        middle = finger_states.get('middle', False)
        ring = finger_states.get('ring', False)
        pinky = finger_states.get('pinky', False)

        # Number gestures
        if index and not middle and not ring and not pinky and not thumb:
            return "1"
        elif index and middle and not ring and not pinky and not thumb:
            return "2"
        elif index and middle and ring and not pinky and not thumb:
            return "3"
        elif index and middle and ring and pinky and not thumb:
            return "4"
        elif index and middle and ring and pinky and thumb:
            return "5"

        # Basic gestures
        if all([thumb, index, middle, ring, pinky]):
            return "Hello! (Full Palm Open)"
        elif not any([index, middle, ring, pinky]):
            return "Thumbs Up" if thumb else "Closed Fist"
        elif index and not middle and not ring and not pinky:
            return "Pointing"
        elif index and middle and not ring and not pinky:
            return "Peace Sign"

        # ASL letters
        if finger_states.get('l_shape', False):
            return "ASL Letter: L"
        elif finger_states.get('v_shape', False):
            return "ASL Letter: V"
        elif finger_states.get('y_shape', False):
            return "ASL Letter: Y"
        elif finger_states.get('c_shape', False):
            return "ASL Letter: C"
        elif finger_states.get('o_shape', False):
            return "ASL Letter: O"
        elif not any([index, middle, ring, pinky]):
            return "ASL Letter: A" if thumb else "ASL Letter: S"

        return "Unrecognized gesture"
    
    def find_best_asl_match(self, finger_states):
        # Simple rule-based matching for ASL letters
        if finger_states.get('index', False) and finger_states.get('middle', False) and finger_states.get('ring', False) and not finger_states.get('pinky', False):
            return "W"
        
        if finger_states.get('index', False) and finger_states.get('pinky', False) and not finger_states.get('middle', False) and not finger_states.get('ring', False):
            return "I"
        
        return None
    
    def process_image(self, image):
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.hands.process(image_rgb)
        
        detected_gesture = "No hand detected"
        
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                mp_drawing.draw_landmarks(
                    image, hand_landmarks, mp_hands.HAND_CONNECTIONS)
                
                finger_states = self.get_finger_states(hand_landmarks)
                detected_gesture = self.detect_gesture(finger_states)
        
        return image, detected_gesture

def check_camera_availability():
    temp_camera = cv2.VideoCapture(0)
    if temp_camera.isOpened():
        is_available = True
        temp_camera.release()
    else:
        is_available = False
    return is_available

def speak_gesture(gesture):
    """
    Speaks the detected gesture using TTS and updates the current gesture.
    """
    global current_gesture, last_speech_time, speech_cooldown, tts_engine, speaker_enabled

    # Skip speaking if the speaker is disabled
    if not speaker_enabled:
        return

    # Skip speaking if no hand is detected
    if gesture == "No hand detected":
        return

    # Speak only if the gesture has changed or cooldown has passed
    current_time = time.time()
    if gesture != current_gesture or (current_time - last_speech_time) > speech_cooldown:
        try:
            # Update the current gesture and last speech time
            current_gesture = gesture
            last_speech_time = current_time

            # Prepare the speech text
            speech_text = gesture.replace("ASL Letter: ", "Letter ")

            # Use the global TTS engine in a thread-safe manner
            def speak_thread(text):
                try:
                    with tts_lock:  # Ensure thread safety
                        tts_engine.say(text)
                        tts_engine.runAndWait()
                except Exception as e:
                    print(f"TTS Error: {str(e)}")

            # Start the TTS in a separate thread
            threading.Thread(target=speak_thread, args=(speech_text,), daemon=True).start()
        except Exception as e:
            print(f"Error in speak_gesture: {str(e)}")


def generate_frames():
    """
    Captures frames from the camera, processes them for hand gestures,
    and updates the global output frame.
    """
    global output_frame, lock, is_camera_running, camera

    try:
        recognizer = HandGestureRecognizer()
        camera = cv2.VideoCapture(0)

        # Wait for the camera to initialize
        for _ in range(10):
            camera.read()

        while is_camera_running:
            success, frame = camera.read()
            if not success:
                print("Error: Unable to read from the camera.")
                break

            # Flip the frame horizontally for a mirror effect
            frame = cv2.flip(frame, 1)

            # Process the frame and detect gestures
            processed_frame, gesture = recognizer.process_image(frame)

            # Speak the gesture if it has changed or cooldown has passed
            threading.Thread(target=speak_gesture, args=(gesture,), daemon=True).start()

            # Display the current gesture on the frame
            cv2.putText(processed_frame, current_gesture, (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

            # Update the global output frame
            with lock:
                output_frame = processed_frame.copy()

            time.sleep(0.05)

    except Exception as e:
        print(f"Error in generate_frames: {str(e)}")
    finally:
        # Ensure resources are released properly
        if recognizer:
            recognizer.close()
        if camera:
            camera.release()

def generate_video_frames():
    global output_frame, lock

    """
    Generator function to yield video frames for streaming.
    If the camera is not available, it yields a blank frame with an error message.
    """
    global is_camera_running

    # Wait for the camera to initialize
    time.sleep(1)
    
    while True:
        with lock:
            if output_frame is None:
                blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(blank_frame, "Camera not available", (80, 240), 
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                (flag, encoded_image) = cv2.imencode('.jpg', blank_frame)
            else:
                (flag, encoded_image) = cv2.imencode('.jpg', output_frame)
            
            if not flag:
                continue

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + bytearray(encoded_image) + b'\r\n')

def apply_hand_points(img_path):
    try:
        image = cv2.imread(img_path)
        if image is None:
            return "Error processing image: Could not read image file", None

        recognizer = HandGestureRecognizer()
        processed_image, gesture = recognizer.process_image(image)
        speak_gesture(gesture)
        recognizer.close()
        
        result_path = os.path.join(app.config['UPLOAD_FOLDER'], 'result.jpg')
        cv2.imwrite(result_path, processed_image)
        
        return gesture, result_path
    except Exception as e:
        return f"Error processing image: {str(e)}", None

# Routes
@app.route('/')
def home():
    user = current_user.username if hasattr(current_user, 'username') else session.get('user', 'Guest')
    return render_template('index.html', user=user)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()

        if user and user.check_password(password):
            login_user(user)
            flash('Logged in successfully!', 'success')
            return redirect(url_for('home'))
        flash('Invalid username or password!', 'danger')
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        confirm_password = request.form['confirm_password']

        if password != confirm_password:
            flash('Passwords do not match!', 'danger')
        elif User.query.filter_by(username=username).first():
            flash('Username already taken!', 'danger')
        elif User.query.filter_by(email=email).first():
            flash('Email already registered!', 'danger')
        else:
            new_user = User(username=username, email=email)
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.commit()
            flash('Account created! Please login.', 'success')
            return redirect(url_for('login'))
    return render_template('signup.html')

@app.route('/guest')
def guest_mode():
    session['user'] = "Guest"
    return redirect(url_for('home'))

@app.route('/logout')
@login_required
def logout():
    logout_user()
    session.pop('user', None)
    flash('Logged out successfully!', 'success')
    return redirect(url_for('login'))

@app.route('/video_feed')
def video_feed():
    return Response(generate_video_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/start_camera')
def start_camera():
    global is_camera_running
    
    if is_camera_running:
        return jsonify({'status': 'Camera is already running'})
    
    if not check_camera_availability():
        return jsonify({'status': 'Camera not available or being used by another application'})
    
    try:
        is_camera_running = True
        threading.Thread(target=generate_frames, daemon=True).start()
        return jsonify({'status': 'Camera started successfully'})
    except Exception as e:
        return jsonify({'status': f'Error starting camera: {str(e)}'})

@app.route('/stop_camera')
def stop_camera():
    global is_camera_running
    
    try:
        is_camera_running = False
        time.sleep(0.5)
        return jsonify({'status': 'Camera stopped'})
    except Exception as e:
        return jsonify({'status': f'Error stopping camera: {str(e)}'})

@app.route('/camera_status')
def camera_status():
    global is_camera_running
    return jsonify({'is_running': is_camera_running})

@app.route('/get_gesture')
def get_gesture():
    global current_gesture
    return jsonify({'gesture': current_gesture})

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'})
    
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(file.filename))
        file.save(file_path)
        
        gesture, result_path = apply_hand_points(file_path)
        
        if result_path:
            with open(result_path, 'rb') as img_file:
                img_base64 = base64.b64encode(img_file.read()).decode('utf-8')
            
            return jsonify({
                'gesture': gesture,
                'image': img_base64
            })
        else:
            return jsonify({'error': gesture})
    except Exception as e:
        return jsonify({'error': f'Error processing upload: {str(e)}'})

@app.route('/about')
def about():
    user = current_user.username if hasattr(current_user, 'username') else session.get('user', 'Guest')
    return render_template('about.html', user=user)

@app.route('/contact')
def contact():
    user = current_user.username if hasattr(current_user, 'username') else session.get('user', 'Guest')
    return render_template('contact.html', user=user)

@app.route('/asl_reference')
def asl_reference():
    user = current_user.username if hasattr(current_user, 'username') else session.get('user', 'Guest')
    return render_template('asl_reference.html', user=user)

@app.route('/toggle_voice', methods=['POST'])
def toggle_voice():
    data = request.get_json()
    voice_enabled = data.get('enabled', True)
    session['voice_enabled'] = voice_enabled
    return jsonify({'status': 'Voice setting updated', 'enabled': voice_enabled})

@app.route("/speak")
def speak():
    try:
        text = request.args.get('text', 'Hello, this is a test message.')
        threading.Thread(target=speak_text, args=(text,)).start()
        return jsonify({'status': 'success', 'message': 'Speech triggered'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/toggle_speaker', methods=['POST'])
def toggle_speaker():
    global speaker_enabled
    speaker_enabled = not speaker_enabled  # Toggle the state
    return jsonify({'speaker_enabled': speaker_enabled})

def speak_text(text):
    """
    Converts text to speech using pyttsx3.
    """
    global tts_engine
    if tts_engine is None:
        init_tts()
    
    if tts_engine is None:
        print("TTS engine not initialized")
        return
    try:
        engine = pyttsx3.init()
        engine.setProperty('rate', 150)
        engine.setProperty('volume', 0.9)
        engine.say(text)
        engine.runAndWait()
    except Exception as e:
        print(f"Error in speak_text: {str(e)}")
        
if __name__ == '__main__':
    # Initial delay to stabilize
    time.sleep(2)  
    app.run(debug=True)