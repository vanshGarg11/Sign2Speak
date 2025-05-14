**# Sign2Speak**

Sign2Speak is a Flask-based web application that recognizes American Sign Language (ASL) hand gestures via webcam or image input and converts them into spoken English using Text-to-Speech (TTS). It includes user authentication, gesture detection using MediaPipe and OpenCV, and a clean frontend interface with pages like Home, About, Contact, and ASL reference.


📌 Features

🔐 User Authentication – Secure signup and login system using Flask-Login and SQLite.


✋ ASL Recognition – Detects ASL alphabet (A–Z) and digits (1–5) using MediaPipe Hands.


🔊 Speech Output – Converts recognized signs into audible English using pyttsx3.


🌐 Web Interface – User-friendly interface built with HTML/CSS (in templates/).


🧠 Fallback Logic – Includes both ML model-based and rule-based gesture detection.


📤 Image Upload & Webcam Input – Support for both image-based and live camera detection.


📚 ASL Reference Page – Visual guide for ASL alphabet and digits.



** Project Structure**

 Sign2Speak/
 
│

├── app.py                  # Main Flask application

├── create_db.py           # Script to initialize the SQLite database

│
├── templates/             # HTML templates

│   ├── index.html

│   ├── login.html

│   ├── signup.html

│   ├── demo.html

│   ├── about.html

│   ├── contact.html

│   └── asl_reference.html

│

├── static/                # Static files (CSS, JS, images)

├── uploads/               # Stores uploaded gesture images (if used)

├── instance/              # Contains SQLite database

├── archive/               # (Optional) Archived or experimental features

├── .venv/                 # Python virtual environment

└── __pycache__/           # Compiled bytecode (auto-generated)



**Setup Instructions**

Clone the repository:

bash

Copy

Edit

git clone https://github.com/your-username/sign2speak.git

cd sign2speak

Create a virtual environment (optional but recommended):

bash

Copy

Edit

python -m venv .venv

source .venv/bin/activate  # On Windows: .venv\Scripts\activate

Install dependencies:


bash

Copy

Edit

pip install -r requirements.txt

Initialize the database:

bash
Copy
Edit
python create_db.py
Run the application:

bash
Copy
Edit
python app.py
Visit the site at:

cpp
Copy
Edit
http://127.0.0.1:5000/
📦 Dependencies
Some of the core packages include:

Flask

Flask-Login

SQLAlchemy

OpenCV (cv2)

MediaPipe

pyttsx3

🧪 How it Works
The app captures hand gestures using your device’s webcam.

MediaPipe processes the hand landmarks.

Either a trained classifier or rule-based logic determines the gesture.

The recognized gesture is converted into text and spoken aloud using pyttsx3.

📸 Demo Pages
/ – Homepage

/login – Login page

/signup – User registration

/demo – Main gesture recognition page

/asl_reference – View ASL chart

/about – About the project

/contact – Contact form

