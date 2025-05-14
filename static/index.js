document.getElementById('start_demo_btn').addEventListener('click', function() {
    document.getElementById('recognition_section').scrollIntoView({
        behavior: 'smooth'
    });
});

// Video feed control
const startBtn = document.getElementById('start_btn');
const stopBtn = document.getElementById('stop_btn');
const videoFeed = document.getElementById('video_feed');
const gestureStatus = document.getElementById('gesture_status');
let isRunning = false;
let gestureInterval = null;

startBtn.addEventListener('click', function() {
    fetch('/start_camera')
        .then(response => response.json())
        .then(data => {
            console.log(data);
            videoFeed.src = "/video_feed";
            startBtn.disabled = true;
            stopBtn.disabled = false;
            isRunning = true;
            
            // Start polling for gesture updates
            gestureInterval = setInterval(updateGestureStatus, 500);
        });
});

stopBtn.addEventListener('click', function() {
    fetch('/stop_camera')
        .then(response => response.json())
        .then(data => {
            console.log(data);
            videoFeed.src = "";
            startBtn.disabled = false;
            stopBtn.disabled = true;
            isRunning = false;
            
            // Stop polling
            clearInterval(gestureInterval);
            gestureStatus.textContent = "Camera stopped";
        });
});

function updateGestureStatus() {
    if (!isRunning) return;
    
    fetch('/get_gesture')
        .then(response => response.json())
        .then(data => {
            gestureStatus.textContent = data.gesture;
        });
}

// Image upload
const uploadForm = document.getElementById('upload_form');
const uploadResult = document.getElementById('upload_result');
const detectedGesture = document.getElementById('detected_gesture');
const resultImage = document.getElementById('result_image');

uploadForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData(uploadForm);
    
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
            return;
        }
        
        // Display result
        detectedGesture.textContent = data.gesture;
        resultImage.src = 'data:image/jpeg;base64,' + data.image;
        uploadResult.style.display = 'block';
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred during upload');
    });
});

// Chatbot functionality
const chatbot = document.getElementById('chatbot');
const openChatbot = document.getElementById('open_chatbot');
const closeChatbot = document.getElementById('close_chatbot');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const chatbotBody = document.getElementById('chatbot-body');

// Knowledge base for website-related questions
const knowledgeBase = {
    // General website questions
    "what is sign2speak": "Sign2Speak is an AI-powered hand gesture recognition platform that translates sign language and hand gestures into text in real-time.",
    "how does sign2speak work": "Sign2Speak uses advanced computer vision technology to detect hand gestures through your camera, then our AI model recognizes the gesture and translates it to text.",
    "what gestures can it recognize": "Our system currently recognizes 15 common gestures used in American Sign Language and everyday communication.",
    
    // Features & capabilities
    "features": "Sign2Speak offers real-time gesture recognition through webcam, image upload analysis, support for 15 common gestures, adaptability to various lighting conditions, and integration options through our API.",
    "supported gestures": "We support 15 common hand gestures including thumbs up, peace sign, pointing, open palm, closed fist, and various ASL letters.",
    "how accurate": "Our gesture recognition technology achieves over 90% accuracy in normal lighting conditions for the supported gestures.",
    
    // Products and services
    "products": "We offer several products: Gesture API for developers, Sign2Speak Mobile App, Enterprise Solutions, Educational Packages, Translation Devices, and Premium Subscriptions.",
    "api": "Our Gesture API allows developers to integrate hand gesture recognition into their own applications and services.",
    "mobile app": "The Sign2Speak Mobile App is available for iOS and Android with offline functionality for gesture recognition on the go.",
    "enterprise": "Our Enterprise Solutions provide customized gesture recognition technology for businesses with dedicated support and integration services.",
    
    // Usage questions
    "how to use": "To use Sign2Speak, click the 'Start Camera' button to begin real-time recognition, or use the upload section to analyze an image containing hand gestures.",
    "upload image": "You can upload an image containing hand gestures in the 'Upload Image' section. Our system will analyze it and identify the gesture.",
    "start camera": "Click the 'Start Camera' button in the recognition section to begin real-time gesture detection through your webcam.",
    
    // Pricing and subscription
    "pricing": "We offer various pricing plans for our services. Basic recognition features are free, while premium features require a subscription. For detailed pricing, please visit our pricing page.",
    "subscription": "Our Premium Subscription provides additional features including an expanded gesture library, voice output, priority support, and more.",
    
    // Contact and support
    "contact": "You can contact us at info@sign2speak.com, call us at +1 (555) 123-4567, or visit our office at 123 Tech Street, San Francisco, CA.",
    "support": "For support, please email support@sign2speak.com or use the contact form on our website.",
    
    // Educational content
    "asl reference": "Our ASL Reference section provides a comprehensive guide to American Sign Language gestures, with tutorials and practice exercises.",
    "learn sign language": "Visit our ASL Reference section to learn sign language. We offer tutorials, practice exercises, and visual guides for beginners to advanced users."
};

// Fallback responses when no match is found
const fallbackResponses = [
    "I'm not sure I understand. Could you rephrase your question?",
    "I don't have information about that. Can I help you with something else related to Sign2Speak?",
    "That's outside my knowledge area. I can help with questions about Sign2Speak features, products, and usage.",
    "I'm not familiar with that topic. Would you like to know about our gesture recognition technology instead?",
    "I'm sorry, I don't have an answer for that. Please try asking about our products, features, or how to use Sign2Speak."
];

// Open chatbot
openChatbot.addEventListener('click', function() {
    chatbot.style.display = 'block';
    openChatbot.style.display = 'none';
    
    // Add welcome message if there are no messages yet
    if (chatbotBody.children.length === 0) {
        addBotMessage("Hello! I'm the Sign2Speak assistant. How can I help you today? You can ask me about our gesture recognition technology, products, or how to use the platform.");
    }
});

// Close chatbot
closeChatbot.addEventListener('click', function() {
    chatbot.style.display = 'none';
    openChatbot.style.display = 'flex';
});

// Send message handlers
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Process and send message
function sendMessage() {
    const message = userInput.value.trim();
    if (message === '') return;
    
    // Add user message to chat
    addUserMessage(message);
    
    // Clear input
    userInput.value = '';
    
    // Get response from knowledge base
    const response = getResponse(message);
    
    // Add bot response with typing effect
    showTypingIndicator();
    setTimeout(() => {
        removeTypingIndicator();
        addBotMessage(response);
    }, 1000 + Math.random() * 1000); // Random delay between 1-2 seconds for natural feel
}

// Find the best response from the knowledge base
function getResponse(message) {
    // Convert message to lowercase for case-insensitive matching
    const query = message.toLowerCase();
    
    // Check for exact matches in knowledge base
    for (const key in knowledgeBase) {
        if (query.includes(key)) {
            return knowledgeBase[key];
        }
    }
    
    // Handle specific question types
    if (query.includes("help") || query.includes("assistance")) {
        return "I can help you with information about Sign2Speak's features, products, and how to use our platform. What would you like to know?";
    }
    
    if (query.includes("thank")) {
        return "You're welcome! Feel free to ask if you have any other questions about Sign2Speak.";
    }
    
    if (query.includes("hello") || query.includes("hi ") || query === "hi") {
        return "Hello! How can I assist you with Sign2Speak today?";
    }
    
    // If no match is found, return a random fallback response
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
}

// Display user message in chat
function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.textContent = text;
    chatbotBody.appendChild(messageDiv);
    chatbotBody.scrollTop = chatbotBody.scrollHeight;
}

// Display bot message in chat
function addBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.textContent = text;
    chatbotBody.appendChild(messageDiv);
    chatbotBody.scrollTop = chatbotBody.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot typing';
    typingDiv.id = 'typing-indicator';
    
    const dot1 = document.createElement('span');
    const dot2 = document.createElement('span');
    const dot3 = document.createElement('span');
    
    dot1.className = 'typing-dot';
    dot2.className = 'typing-dot';
    dot3.className = 'typing-dot';
    
    typingDiv.appendChild(dot1);
    typingDiv.appendChild(dot2);
    typingDiv.appendChild(dot3);
    
    chatbotBody.appendChild(typingDiv);
    chatbotBody.scrollTop = chatbotBody.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Add CSS for typing indicator animation
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
        .typing {
            display: flex;
            align-items: center;
            padding: 10px 15px;
        }
        
        .typing-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: #707070;
            margin-right: 4px;
            animation: typingAnimation 1.5s infinite ease-in-out;
        }
        
        .typing-dot:nth-child(1) {
            animation-delay: 0s;
        }
        
        .typing-dot:nth-child(2) {
            animation-delay: 0.3s;
        }
        
        .typing-dot:nth-child(3) {
            animation-delay: 0.6s;
            margin-right: 0;
        }
        
        @keyframes typingAnimation {
            0%, 60%, 100% {
                transform: translateY(0);
            }
            30% {
                transform: translateY(-6px);
            }
        }
        
        .chatbot {
            border-radius: 10px;
            box-shadow: 0 5px 25px rgba(0, 0, 0, 0.2);
            transition: all 0.3s ease;
        }
        
        .chatbot-body {
            max-height: 350px;            
        }
        
        .message {
            margin-bottom: 10px;
            padding: 10px 15px;
            border-radius: 10px;
            max-width: 80%;
            word-wrap: break-word;
        }
        
        .message.user {
            background-color: #e6f2ff;
            margin-left: auto;
            border-top-right-radius: 2px;
        }
        
        .message.bot {
            background-color: #f0f0f0;
            margin-right: auto;
            border-top-left-radius: 2px;
        }
        
        .chatbot-input {
            border-top: 1px solid #e6e6e6;
        }
        
        .chatbot-input input {
            border: none;
            outline: none;
        }
        
        #open_chatbot {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% {
                box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.4);
            }
            70% {
                box-shadow: 0 0 0 10px rgba(0, 123, 255, 0);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(0, 123, 255, 0);
            }
        }
    `;
    document.head.appendChild(style);
});
function revealOnScroll() {
const reveals = document.querySelectorAll('.reveal-left, .reveal-right, .reveal-up');

for (let i = 0; i < reveals.length; i++) {
    const windowHeight = window.innerHeight;
    const elementTop = reveals[i].getBoundingClientRect().top;
    const elementVisible = 150;
    
    if (elementTop < windowHeight - elementVisible) {
        reveals[i].classList.add('active');
    }
}
}

window.addEventListener('scroll', revealOnScroll);
window.addEventListener('load', revealOnScroll);

// Add animation classes to elements
document.addEventListener('DOMContentLoaded', function() {
// Add reveal classes to sections
document.querySelector('.benefits-title').classList.add('reveal-up');
document.querySelectorAll('.benefit-card').forEach(card => {
    card.classList.add('reveal-up');
});

document.querySelector('.recognition-section h2').classList.add('reveal-up');
document.querySelector('.recognition-section .lead').classList.add('reveal-up');

const cards = document.querySelectorAll('.card');
cards[0].classList.add('reveal-left');
cards[1].classList.add('reveal-right');

document.querySelector('.related-title').classList.add('reveal-up');
document.querySelectorAll('.product-card').forEach(card => {
    card.classList.add('reveal-up');
});
});

// Add animation to chatbot
document.getElementById('open_chatbot').addEventListener('click', function() {
const chatbot = document.getElementById('chatbot');
chatbot.style.display = 'block';
chatbot.style.animation = 'slideInRight 0.5s forwards';
});
document.addEventListener('DOMContentLoaded', function() {
// Create floating hand elements for decoration
const heroSection = document.querySelector('.hero-section');

// Create 5 floating hand icons with different animations
for (let i = 0; i < 5; i++) {
    const hand = document.createElement('i');
    hand.className = 'fas fa-hand-paper floating';
    hand.style.position = 'absolute';
    hand.style.color = 'rgba(255, 255, 255, 0.1)';
    hand.style.fontSize = `${30 + Math.random() * 20}px`;
    hand.style.left = `${Math.random() * 100}%`;
    hand.style.top = `${Math.random() * 100}%`;
    hand.style.animationDelay = `${Math.random() * 2}s`;
    hand.style.animationDuration = `${6 + Math.random() * 4}s`;
    hand.style.zIndex = '0';
    
    heroSection.appendChild(hand);
}

// Interactive hover effect for benefit cards
const benefitCards = document.querySelectorAll('.benefit-card');
benefitCards.forEach(card => {
    card.addEventListener('mousemove', function(e) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const angleX = (y - centerY) / 20;
        const angleY = (centerX - x) / 20;
        
        card.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg) translateY(-10px)`;
    });
    
    card.addEventListener('mouseleave', function() {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
        setTimeout(() => {
            card.style.transform = '';
        }, 300);
    });
});

// Add wobble animation to buttons on click
const buttons = document.querySelectorAll('.btn');
buttons.forEach(button => {
    button.addEventListener('click', function() {
        // Only add the animation if it's not already there
        if (!button.style.animation || button.style.animation === '') {
            button.style.animation = 'wobble 0.8s';
            
            button.addEventListener('animationend', function() {
                button.style.animation = '';
            }, {once: true});
        }
    });
});

// Change status panel color based on gesture status
const gestureStatusEl = document.getElementById('gesture_status');
const statusPanel = document.querySelector('.status-panel');

// This is just an example - you'll need to hook into your actual gesture detection
setInterval(() => {
    if (gestureStatusEl.textContent.includes('Recognized') && Math.random() > 0.5) {
        statusPanel.style.backgroundColor = '#d4edda';
        statusPanel.style.transition = 'background-color 0.5s ease';
        
        setTimeout(() => {
            statusPanel.style.backgroundColor = '#f8f9fa';
        }, 1000);
    }
}, 3000);
});
// Add this script at the end of your HTML file, just before the closing </body> tag

document.addEventListener('DOMContentLoaded', function() {
    // 1. Particle Animation for Hero Section
    createParticleCanvas();
    
    // 2. Enhanced 3D card interactions
    enhanceBenefitCards();
    
    // 3. Gesture illustration animation
    createGestureIllustration();
    
    // 4. Enhanced button interactions
    enhanceButtonInteractions();
    
    // 5. More scroll reveal animations
    enhanceScrollReveal();
    
    // 6. Typing animation for hero title
    animateHeroTitle();
});

// 1. Particle Animation for Hero Section
function createParticleCanvas() {
    const heroSection = document.querySelector('.hero-section');
    const canvas = document.createElement('canvas');
    canvas.id = 'particle-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '0';
    canvas.style.opacity = '0.3';
    
    // Insert canvas as first child of hero section
    heroSection.insertBefore(canvas, heroSection.firstChild);
    
    // Move container to front
    const container = heroSection.querySelector('.container');
    container.style.position = 'relative';
    container.style.zIndex = '1';
    
    // Initialize particles
    const ctx = canvas.getContext('2d');
    const particles = [];
    const particleCount = 50;
    
    function resizeCanvas() {
        canvas.width = heroSection.offsetWidth;
        canvas.height = heroSection.offsetHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Create particles
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 3 + 1,
            vx: Math.random() * 2 - 1,
            vy: Math.random() * 2 - 1,
            opacity: Math.random() * 0.5 + 0.2
        });
    }
    
    // Draw particles
    function drawParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw particles
        particles.forEach(particle => {
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
            ctx.fill();
            
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Bounce off edges
            if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
            if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;
        });
        
        // Draw connections
        particles.forEach((particle, i) => {
            particles.slice(i + 1).forEach(otherParticle => {
                const dx = particle.x - otherParticle.x;
                const dy = particle.y - otherParticle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 100) {
                    ctx.beginPath();
                    ctx.moveTo(particle.x, particle.y);
                    ctx.lineTo(otherParticle.x, otherParticle.y);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * (1 - distance / 100)})`;
                    ctx.stroke();
                }
            });
        });
        
        requestAnimationFrame(drawParticles);
    }
    
    drawParticles();
}

// 2. Enhanced 3D card interactions
function enhanceBenefitCards() {
    const cards = document.querySelectorAll('.benefit-card');
    
    cards.forEach(card => {
        const icon = card.querySelector('.benefit-icon');
        
        // Add shine effect element
        const shineEffect = document.createElement('div');
        shineEffect.classList.add('shine-effect');
        shineEffect.style.position = 'absolute';
        shineEffect.style.top = '0';
        shineEffect.style.left = '0';
        shineEffect.style.width = '100%';
        shineEffect.style.height = '100%';
        shineEffect.style.background = 'linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)';
        shineEffect.style.transform = 'translateX(-100%)';
        shineEffect.style.zIndex = '1';
        shineEffect.style.pointerEvents = 'none';
        card.style.position = 'relative';
        card.style.overflow = 'hidden';
        card.appendChild(shineEffect);
        
        card.addEventListener('mouseenter', () => {
            // Animate icon
            icon.style.animation = 'bounce 0.5s ease';
            setTimeout(() => {
                icon.style.animation = '';
            }, 500);
            
            // Trigger shine effect
            shineEffect.style.transition = 'transform 0.6s ease-in-out';
            shineEffect.style.transform = 'translateX(100%)';
            
            setTimeout(() => {
                shineEffect.style.transition = 'none';
                shineEffect.style.transform = 'translateX(-100%)';
            }, 600);
        });
        
        // 3D tilt effect
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // Calculate rotation angles
            const angleX = (y - centerY) / 15;
            const angleY = (centerX - x) / 15;
            
            card.style.transform = `perspective(800px) rotateX(${angleX}deg) rotateY(${angleY}deg) scale(1.02)`;
            card.style.transition = 'transform 0.05s ease-out';
            
            // Add dynamic shadow based on tilt
            card.style.boxShadow = `${-angleY * 0.5}px ${angleX * 0.5}px 15px rgba(0, 0, 0, 0.15)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)';
            card.style.transition = 'transform 0.5s ease-out, box-shadow 0.5s ease-out';
            card.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        });
    });
}

// 3. Gesture Illustration Animation
function createGestureIllustration() {
    const gestureStatus = document.getElementById('gesture_status');
    if (!gestureStatus) return;
    
    const container = gestureStatus.parentElement;
    
    // Create hand icon
    const handIcon = document.createElement('div');
    handIcon.innerHTML = '<i class="fas fa-hand-paper"></i>';
    handIcon.style.fontSize = '40px';
    handIcon.style.color = '#3a86ff';
    handIcon.style.textAlign = 'center';
    handIcon.style.marginBottom = '15px';
    handIcon.style.textShadow = '2px 2px 8px rgba(58, 134, 255, 0.3)';
    
    // Insert hand icon before status text
    container.insertBefore(handIcon, gestureStatus);
    
    // Add gesture animation loop
    const gestures = [
        { icon: 'fas fa-hand-paper', color: '#3a86ff' },
        { icon: 'fas fa-hand-peace', color: '#ff006e' },
        { icon: 'fas fa-thumbs-up', color: '#8338ec' },
        { icon: 'fas fa-hand-point-up', color: '#06d6a0' }
    ];
    
    let currentIndex = 0;
    
    // Only run animation if camera isn't active
    let animationInterval = setInterval(() => {
        if (gestureStatus.textContent === "Waiting for Gesture Recognition") {
            const gesture = gestures[currentIndex];
            handIcon.innerHTML = `<i class="${gesture.icon}"></i>`;
            handIcon.style.color = gesture.color;
            
            // Add animation
            const icon = handIcon.querySelector('i');
            icon.style.animation = 'bounceIn 0.5s ease-out';
            setTimeout(() => {
                icon.style.animation = '';
            }, 500);
            
            currentIndex = (currentIndex + 1) % gestures.length;
        }
    }, 3000);
    
    // Create animation style
    const style = document.createElement('style');
    style.textContent = `
        @keyframes bounceIn {
            0% { transform: scale(0.8); opacity: 0.7; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    // Update when camera starts/stops
    const startBtn = document.getElementById('start_btn');
    const stopBtn = document.getElementById('stop_btn');
    
    if (startBtn && stopBtn) {
        startBtn.addEventListener('click', () => {
            handIcon.style.display = 'none';
        });
        
        stopBtn.addEventListener('click', () => {
            handIcon.style.display = 'block';
        });
    }
}

// 4. Enhanced Button Interactions
function enhanceButtonInteractions() {
    const buttons = document.querySelectorAll('.btn');
    
    buttons.forEach(button => {
        // Create ripple effect for buttons
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            ripple.style.position = 'absolute';
            ripple.style.borderRadius = '50%';
            ripple.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
            ripple.style.transform = 'scale(0)';
            ripple.style.animation = 'ripple 0.6s linear';
            ripple.style.pointerEvents = 'none';
            
            // Set button to relative position if not already
            if (getComputedStyle(this).position === 'static') {
                this.style.position = 'relative';
            }
            this.style.overflow = 'hidden';
            
            // Position the ripple
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${e.clientX - rect.left - size/2}px`;
            ripple.style.top = `${e.clientY - rect.top - size/2}px`;
            
            button.appendChild(ripple);
            
            // Remove ripple after animation
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
        
        // Add hover effect
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
            this.style.boxShadow = '0 7px 14px rgba(0, 0, 0, 0.15)';
            this.style.transition = 'all 0.3s ease';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '';
        });
    });
    
    // Add ripple animation style
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// 5. Enhanced Scroll Reveal Animations
function enhanceScrollReveal() {
    const elementsToAnimate = [
        { selector: '.benefit-card', animation: 'fadeInUp', delay: 0.2 },
        { selector: '.card', animation: 'fadeInLeft', delay: 0.3 },
        { selector: '.product-card', animation: 'fadeInRight', delay: 0.2 },
        { selector: '.hero-title', animation: 'zoomIn', delay: 0 },
        { selector: '.hero-text', animation: 'fadeIn', delay: 0.3 },
        { selector: '.hero-section .btn', animation: 'bounceIn', delay: 0.5 },
        { selector: '.benefits-title', animation: 'fadeInDown', delay: 0.1 },
        { selector: '.related-title', animation: 'fadeInDown', delay: 0.1 }
    ];
    
    // Create animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInUp {
            from { opacity: 0; transform: translate3d(0, 40px, 0); }
            to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        
        @keyframes fadeInLeft {
            from { opacity: 0; transform: translate3d(-40px, 0, 0); }
            to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        
        @keyframes fadeInRight {
            from { opacity: 0; transform: translate3d(40px, 0, 0); }
            to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        
        @keyframes fadeInDown {
            from { opacity: 0; transform: translate3d(0, -40px, 0); }
            to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        
        @keyframes zoomIn {
            from { opacity: 0; transform: scale3d(0.3, 0.3, 0.3); }
            50% { opacity: 1; }
        }
        
        @keyframes bounceIn {
            from, 20%, 40%, 60%, 80%, to { animation-timing-function: cubic-bezier(0.215, 0.610, 0.355, 1.000); }
            0% { opacity: 0; transform: scale3d(0.3, 0.3, 0.3); }
            20% { transform: scale3d(1.1, 1.1, 1.1); }
            40% { transform: scale3d(0.9, 0.9, 0.9); }
            60% { opacity: 1; transform: scale3d(1.03, 1.03, 1.03); }
            80% { transform: scale3d(0.97, 0.97, 0.97); }
            to { opacity: 1; transform: scale3d(1, 1, 1); }
        }
        
        .animate {
            animation-duration: 0.8s;
            animation-fill-mode: both;
        }
        
        .animate.delay-1 { animation-delay: 0.1s; }
        .animate.delay-2 { animation-delay: 0.2s; }
        .animate.delay-3 { animation-delay: 0.3s; }
        .animate.delay-4 { animation-delay: 0.4s; }
        .animate.delay-5 { animation-delay: 0.5s; }
    `;
    document.head.appendChild(style);
    
    // Initialize initial animations
    elementsToAnimate.forEach(item => {
        const elements = document.querySelectorAll(item.selector);
        elements.forEach((el, index) => {
            el.classList.add('animate');
            el.style.opacity = '0';
            el.style.animationName = item.animation;
            el.style.animationDelay = `${item.delay + (index * 0.1)}s`;
        });
    });
    
    // Add scroll animations
    function scrollAnimations() {
        const elements = document.querySelectorAll('.scroll-animate');
        const windowHeight = window.innerHeight;
        
        elements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const elementVisible = 150;
            
            if (elementTop < windowHeight - elementVisible) {
                element.classList.add('active');
            }
        });
    }
    
    // Mark sections as scroll-animate
    const scrollSections = [
        '.recognition-section .card',
        '.related-products .product-card',
        '.benefits-section .benefit-card'
    ];
    
    scrollSections.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            el.classList.add('scroll-animate');
            el.classList.add('fade-up');
        });
    });
    
    window.addEventListener('scroll', scrollAnimations);
    
    // Add classes for scroll animations
    const scrollStyles = document.createElement('style');
    scrollStyles.textContent = `
        .scroll-animate {
            opacity: 0;
            transition: all 0.8s ease;
        }
        
        .fade-up {
            transform: translateY(40px);
        }
        
        .fade-left {
            transform: translateX(-40px);
        }
        
        .fade-right {
            transform: translateX(40px);
        }
        
        .scroll-animate.active {
            opacity: 1;
            transform: translate(0, 0);
        }
    `;
    document.head.appendChild(scrollStyles);
}

// 6. Typing animation for hero title
function animateHeroTitle() {
    const heroTitle = document.querySelector('.hero-title');
    if (!heroTitle) return;
    
    const originalText = heroTitle.textContent;
    heroTitle.textContent = '';
    heroTitle.style.borderRight = '0.15em solid #fff';
    heroTitle.style.animation = 'blinkCursor 0.75s step-end infinite';
    
    let charIndex = 0;
    
    const typeInterval = setInterval(() => {
        if (charIndex < originalText.length) {
            heroTitle.textContent += originalText.charAt(charIndex);
            charIndex++;
        } else {
            clearInterval(typeInterval);
            heroTitle.style.borderRight = 'none';
            heroTitle.style.animation = '';
        }
    }, 100);
    
    // Add cursor blink animation style
    const style = document.createElement('style');
    style.textContent = `
        @keyframes blinkCursor {
            from, to { border-color: transparent; }
            50% { border-color: white; }
        }
    `;
    document.head.appendChild(style);
}


    function toggleSpeaker() {
        // Immediately update the UI to show the toggle action
        const statusElement = document.getElementById('speaker-status');
        const buttonElement = document.getElementById('toggle-speaker');

        // Disable the button temporarily to prevent multiple clicks
        buttonElement.disabled = true;

        fetch('/toggle_speaker', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                const status = data.speaker_enabled ? 'enabled' : 'disabled';
                statusElement.innerText = `Speaker is ${status}`;
            })
            .catch(error => console.error('Error toggling speaker:', error))
            .finally(() => {
                // Re-enable the button after the request completes
                buttonElement.disabled = false;
            });
    }

    // Attach the function to the button
    document.getElementById('toggle-speaker').addEventListener('click', toggleSpeaker);
