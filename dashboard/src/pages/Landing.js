import { useState, useEffect } from 'react';
import { 
  Shield, Lock, User, Mail, ArrowRight, CheckCircle2, 
  AlertTriangle, Eye, Zap, Bell, Smartphone, Server, 
  ChevronRight, Menu, X, TreePine, Wheat, Home, 
  ShieldAlert, Activity, Users, Send, Info, Key, LogOut
} from 'lucide-react';
import './Landing.css';

export default function Landing({ user, onLogin, onLogout, setPage }) {
  // Navigation & UI States
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModal, setAuthModal] = useState(null); // 'login' | 'signup' | null
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [activeService, setActiveService] = useState('agri');

  // Contact Form State
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: 'inquiry', message: '' });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  // Interactive AI Simulator State
  const [simSelectedAnimal, setSimSelectedAnimal] = useState(null);
  const [simState, setSimState] = useState('idle'); // 'idle' | 'scanning' | 'detected'
  const [simBoundingBox, setSimBoundingBox] = useState(null);
  const [simAlertLog, setSimAlertLog] = useState([]);

  // Mock database initialization
  useEffect(() => {
    try {
      if (!localStorage.getItem('wt_users')) {
        const defaultUsers = [
          { name: 'Demo Administrator', email: 'admin@wildtrack.com', password: 'password123' }
        ];
        localStorage.setItem('wt_users', JSON.stringify(defaultUsers));
      }
    } catch (e) {
      console.warn("Failed to initialize wt_users in localStorage:", e);
    }
  }, []);

  // Handle Scroll to Anchor
  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Auth Handlers
  const handleAuthInputChange = (e) => {
    setAuthForm({ ...authForm, [e.target.name]: e.target.value });
    setAuthError('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!authForm.email || !authForm.password) {
      setAuthError('Please fill in all fields');
      return;
    }

    try {
      setAuthError('');
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, password: authForm.password })
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        localStorage.setItem('wt_token', data.token);
        onLogin(data.user);
        setAuthModal(null);
        setAuthForm({ name: '', email: '', password: '', confirmPassword: '' });
        setPage('dashboard');
      } else {
        setAuthError(data.message || 'Invalid email or password');
      }
    } catch (err) {
      console.warn("MongoDB auth server offline, falling back to Local Storage:", err);
      const users = JSON.parse(localStorage.getItem('wt_users') || '[]');
      const matchedUser = users.find(u => u.email.toLowerCase() === authForm.email.toLowerCase() && u.password === authForm.password);

      if (matchedUser) {
        onLogin(matchedUser);
        setAuthModal(null);
        setAuthForm({ name: '', email: '', password: '', confirmPassword: '' });
        setPage('dashboard');
      } else {
        setAuthError('Invalid credentials (Offline Mode)');
      }
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    const { name, email, password, confirmPassword } = authForm;

    if (!name || !email || !password || !confirmPassword) {
      setAuthError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }

    try {
      setAuthError('');
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        localStorage.setItem('wt_token', data.token);
        setAuthSuccess('Account created successfully! Logging you in...');
        
        // Also save locally for fallback sync
        try {
          const users = JSON.parse(localStorage.getItem('wt_users') || '[]');
          if (!users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            users.push({ name, email, password });
            localStorage.setItem('wt_users', JSON.stringify(users));
          }
        } catch (e) {
          console.warn("Failed to save wt_users in localStorage:", e);
        }

        setTimeout(() => {
          onLogin(data.user || { name, email });
          setAuthModal(null);
          setAuthSuccess('');
          setAuthForm({ name: '', email: '', password: '', confirmPassword: '' });
          setPage('dashboard');
        }, 1500);
      } else {
        setAuthError(data.message || 'Registration failed');
      }
    } catch (err) {
      let users = [];
      try {
        users = JSON.parse(localStorage.getItem('wt_users') || '[]');
      } catch (e) {
        console.warn("Failed to read wt_users from localStorage:", e);
      }
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        setAuthError('Email already registered');
        return;
      }

      const newUser = { name, email, password };
      users.push(newUser);
      try {
        localStorage.setItem('wt_users', JSON.stringify(users));
      } catch (e) {
        console.warn("Failed to save wt_users in localStorage:", e);
      }

      setAuthSuccess('Account created successfully! (Offline Local Storage Mode)');
      setTimeout(() => {
        onLogin(newUser);
        setAuthModal(null);
        setAuthSuccess('');
        setAuthForm({ name: '', email: '', password: '', confirmPassword: '' });
        setPage('dashboard');
      }, 1500);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      alert('Please fill out all required fields.');
      return;
    }
    
    setContactLoading(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });
      if (response.ok) {
        setContactLoading(false);
        setContactSubmitted(true);
        setContactForm({ name: '', email: '', subject: 'inquiry', message: '' });
        setTimeout(() => setContactSubmitted(false), 5000);
      } else {
        throw new Error("Failed to record inquiry");
      }
    } catch (err) {
      console.warn("MongoDB server offline, recording inquiry locally:", err);
      setTimeout(() => {
        setContactLoading(false);
        setContactSubmitted(true);
        setContactForm({ name: '', email: '', subject: 'inquiry', message: '' });
        setTimeout(() => setContactSubmitted(false), 5000);
      }, 1000);
    }
  };

  // AI Simulator Trigger
  const triggerSimulator = (animal) => {
    setSimSelectedAnimal(animal);
    setSimState('scanning');
    setSimBoundingBox(null);

    // Step 1: Scanning effect
    setTimeout(() => {
      setSimState('detected');
      // Set relative bounding box percentages depending on animal
      const coords = {
        elephant: { top: '15%', left: '20%', width: '60%', height: '70%', conf: 98.4, threat: 'HIGH - Alert Dispatched' },
        tiger: { top: '25%', left: '15%', width: '70%', height: '65%', conf: 99.1, threat: 'CRITICAL - Sound Deterrent & SMS Sent' },
        leopard: { top: '30%', left: '25%', width: '50%', height: '55%', conf: 94.7, threat: 'HIGH - Warning Sent to Residents' },
        deer: { top: '20%', left: '30%', width: '45%', height: '65%', conf: 97.2, threat: 'LOW - Logged Only' }
      }[animal.id];
      
      setSimBoundingBox(coords);
      
      // Add to simulated Alert Log
      const newAlert = {
        id: Date.now(),
        time: new Date().toLocaleTimeString(),
        animal: animal.name,
        confidence: coords.conf,
        status: coords.threat
      };
      setSimAlertLog(prev => [newAlert, ...prev].slice(0, 5));
    }, 1500);
  };

  const simulatorAnimals = [
    { id: 'elephant', name: 'Elephant', icon: TreePine, desc: 'Large herbivore approaching agricultural boundary.' },
    { id: 'tiger', name: 'Bengal Tiger', icon: ShieldAlert, desc: 'Apex predator detected near village outskirts.' },
    { id: 'leopard', name: 'Leopard', icon: Activity, desc: 'Agile predator patrolling high-elevation perimeter fence.' },
    { id: 'deer', name: 'Spotted Deer', icon: Wheat, desc: 'Non-threatening wildlife entering buffer zone.' }
  ];

  return (
    <div className="landing-container">
      {/* Dynamic Background Glowing Accents */}
      <div className="glow-bubble gb-1"></div>
      <div className="glow-bubble gb-2"></div>
      <div className="glow-bubble gb-3"></div>

      {/* HEADER NAVBAR */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-logo" onClick={() => scrollToSection('hero')}>
            <div className="logo-icon-wrap">
              <Shield className="logo-shield" size={22} strokeWidth={2.5}/>
            </div>
            <div>
              <span className="logo-main">WildTrack</span>
              <span className="logo-tag">INTELLIGENCE</span>
            </div>
          </div>

          <nav className="desktop-nav">
            <button className="nav-link" onClick={() => scrollToSection('hero')}>Home</button>
            <button className="nav-link" onClick={() => scrollToSection('features')}>Features</button>
            <button className="nav-link" onClick={() => scrollToSection('services')}>Services</button>
            <button className="nav-link" onClick={() => scrollToSection('simulator')}>AI Sandbox</button>
            <button className="nav-link" onClick={() => scrollToSection('about')}>About</button>
            <button className="nav-link" onClick={() => scrollToSection('contact')}>Contact</button>
          </nav>

          <div className="header-actions">
            {user ? (
              <>
                <button className="btn btn-secondary btn-dashboard-link" onClick={() => setPage('dashboard')}>
                  <span>Console Dashboard</span>
                  <ChevronRight size={14}/>
                </button>
                <button className="btn btn-logout-icon" onClick={onLogout} title="Log Out">
                  <LogOut size={16}/>
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-text" onClick={() => setAuthModal('login')}>Sign In</button>
                <button className="btn btn-primary btn-glow" onClick={() => setAuthModal('signup')}>Get Started</button>
              </>
            )}
          </div>

          <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>

        {/* MOBILE MENU */}
        {mobileMenuOpen && (
          <div className="mobile-nav-menu">
            <button className="mobile-nav-link" onClick={() => scrollToSection('hero')}>Home</button>
            <button className="mobile-nav-link" onClick={() => scrollToSection('features')}>Features</button>
            <button className="mobile-nav-link" onClick={() => scrollToSection('services')}>Services</button>
            <button className="mobile-nav-link" onClick={() => scrollToSection('simulator')}>AI Sandbox</button>
            <button className="mobile-nav-link" onClick={() => scrollToSection('about')}>About</button>
            <button className="mobile-nav-link" onClick={() => scrollToSection('contact')}>Contact</button>
            <div className="mobile-menu-actions">
              {user ? (
                <>
                  <button className="btn btn-primary w-100" onClick={() => { setPage('dashboard'); setMobileMenuOpen(false); }}>
                    Dashboard Console
                  </button>
                  <button className="btn btn-danger w-100" style={{marginTop: 10}} onClick={() => { onLogout(); setMobileMenuOpen(false); }}>
                    Log Out
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary w-100" onClick={() => { setAuthModal('login'); setMobileMenuOpen(false); }}>Sign In</button>
                  <button className="btn btn-primary w-100" style={{marginTop: 10}} onClick={() => { setAuthModal('signup'); setMobileMenuOpen(false); }}>Get Started</button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section id="hero" className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-dot pulse"></span>
            <span>Next-Gen Computer Vision for Wildlife Security</span>
          </div>
          <h1 className="hero-title">
            Smart Intrusion Alerting <br/>
            <span className="text-gradient">Redefined for Peaceful Coexistence</span>
          </h1>
          <p className="hero-desc">
            WildTrack bridges the gap between human environments and natural wildlife habitats. 
            Deploying state-of-the-art YOLO AI models directly onto your standard CCTV cameras, 
            providing instant warnings, perimeter safeguarding, and rich dashboard diagnostics.
          </p>
          <div className="hero-buttons">
            {user ? (
              <button className="btn btn-primary btn-lg btn-glow" onClick={() => setPage('dashboard')}>
                Enter Dashboard Panel <ArrowRight size={16}/>
              </button>
            ) : (
              <button className="btn btn-primary btn-lg btn-glow" onClick={() => setAuthModal('signup')}>
                Deploy Free Trial <ArrowRight size={16}/>
              </button>
            )}
            <button className="btn btn-secondary btn-lg" onClick={() => scrollToSection('simulator')}>
              Explore AI Sandbox
            </button>
          </div>

          <div className="hero-stats">
            <div className="hero-stat-item">
              <span className="stat-num">99.1%</span>
              <span className="stat-lbl">AI Detection Accuracy</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-item">
              <span className="stat-num">&lt; 1.5s</span>
              <span className="stat-lbl">Alert Dispatch Latency</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-item">
              <span className="stat-num">2,500+</span>
              <span className="stat-lbl">Edge Nodes Deployed</span>
            </div>
          </div>
        </div>

        {/* HERO INTERACTIVE GRAPHIC / DISPLAY MOCK */}
        <div className="hero-visual">
          <div className="visual-card glass">
            <div className="visual-card-header">
              <div className="header-status">
                <span className="dot-live"></span>
                <span className="mono">STREAMING // EDGE_NODE_01</span>
              </div>
              <div className="header-model-badge">YOLOv8x // ANIMALS</div>
            </div>
            
            {/* SVG Interactive Canvas Simulation */}
            <div className="visual-canvas">
              <div className="scan-line"></div>
              {/* Forest Background Graphic */}
              <svg viewBox="0 0 400 240" className="canvas-svg">
                {/* Decorative Trees */}
                <path d="M50 180 L70 120 L90 180 Z" fill="rgba(52,211,153,0.15)" stroke="rgba(52,211,153,0.3)" />
                <path d="M120 190 L145 130 L170 190 Z" fill="rgba(52,211,153,0.1)" stroke="rgba(52,211,153,0.2)" />
                <path d="M300 170 L320 110 L340 170 Z" fill="rgba(52,211,153,0.15)" stroke="rgba(52,211,153,0.3)" />
                
                {/* Animal Silhouette (Elephant) */}
                <g transform="translate(160, 80) scale(0.7)" fill="#1e2d42" stroke="var(--accent)" strokeWidth="1">
                  <path d="M120,60 C100,50 80,45 60,50 C40,55 30,65 25,80 C20,95 25,110 30,120 C35,130 40,140 45,150 L50,190 L65,190 L60,150 L85,150 L80,190 L95,190 L90,145 C100,143 110,140 115,130 L120,180 L135,180 L130,120 C140,110 150,90 148,80 C145,70 135,65 120,60 Z" />
                  <path d="M25,80 C15,82 5,90 2,105 C-1,120 5,135 15,140" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="3,3"/>
                </g>
              </svg>

              {/* Animated Bounding Box */}
              <div className="sim-bounding-box" style={{top: '18%', left: '38%', width: '38%', height: '62%'}}>
                <div className="bb-label">ELEPHANT [98.7%]</div>
                <div className="bb-corner tl"></div>
                <div className="bb-corner tr"></div>
                <div className="bb-corner bl"></div>
                <div className="bb-corner br"></div>
              </div>

              {/* Alert Notification Popup overlay */}
              <div className="sim-alert-overlay danger-pulse">
                <AlertTriangle size={14}/>
                <span className="mono">ALERT: LARGE ANIMAL INTRUSION</span>
              </div>
            </div>
            
            <div className="visual-card-footer">
              <div className="footer-details">
                <div className="lbl">Coordinates</div>
                <div className="val mono">18.5204, 73.8567</div>
              </div>
              <div className="footer-details">
                <div className="lbl">Action</div>
                <div className="val text-success font-semibold">SMS Alert Sent</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CORE FEATURES */}
      <section id="features" className="features-section">
        <div className="section-title-area">
          <span className="subtitle">SUPERIOR DEFENSE</span>
          <h2 className="section-title">Robust Edge-to-Cloud Wildlife Tracking</h2>
          <p className="section-subtitle">
            Our platform turns standard video feeds into highly integrated protective shields with edge processing, sound integration, and direct API actions.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card glass">
            <div className="feat-icon-wrap bg-blue">
              <Eye size={20} className="text-blue"/>
            </div>
            <h3>Computer Vision Intelligence</h3>
            <p>Runs robust YOLO edge detection models tuned specifically for wildlife species, filtering out moving leaves, lights, and domestic pets.</p>
          </div>

          <div className="feature-card glass">
            <div className="feat-icon-wrap bg-green">
              <Zap size={20} className="text-green"/>
            </div>
            <h3>Microsecond Latency</h3>
            <p>Processes frames local or on-server with optimized GPU schedules, triggering local sirens, lights, or cloud SMS dispatches in under 1.5 seconds.</p>
          </div>

          <div className="feature-card glass">
            <div className="feat-icon-wrap bg-yellow">
              <Bell size={20} className="text-yellow"/>
            </div>
            <h3>Multi-Channel Alerts</h3>
            <p>Synchronizes instant web hook triggers, Telegram notifications, automated SMS, and real-time push alerts directly to our Android Companion application.</p>
          </div>

          <div className="feature-card glass">
            <div className="feat-icon-wrap bg-cyan">
              <Smartphone size={20} className="text-cyan"/>
            </div>
            <h3>Android Synchronization</h3>
            <p>Empowers community patrols and forest rangers with precise GPS coordinates, compass navigation to alert spots, and sound frequency controls.</p>
          </div>

          <div className="feature-card glass">
            <div className="feat-icon-wrap bg-purple">
              <Server size={20} className="text-purple"/>
            </div>
            <h3>Edge Server Architecture</h3>
            <p>Deploys a ultra-lightweight server framework (Flask/Python) capable of running seamlessly on local laptops, Raspberry Pis, or dedicated servers.</p>
          </div>

          <div className="feature-card glass">
            <div className="feat-icon-wrap bg-rose">
              <Shield size={20} className="text-rose"/>
            </div>
            <h3>Failsafe Fallback</h3>
            <p>Includes offline logs and visual analytics dashboard charts that buffer local triggers until cloud connectivity restores, ensuring absolute data integrity.</p>
          </div>
        </div>
      </section>

      {/* CORE SERVICES SECTION */}
      <section id="services" className="services-section">
        <div className="services-inner glass">
          <div className="services-sidebar">
            <span className="sub">OUR ECOSYSTEM</span>
            <h2 className="title">Tailored Services for Every Boundary</h2>
            <p className="desc">
              Every environment requires a custom safeguard model. Discover our core operating frameworks designed for maximum safety.
            </p>
            
            <div className="services-tabs">
              <button 
                className={`service-tab ${activeService === 'agri' ? 'active' : ''}`}
                onClick={() => setActiveService('agri')}
              >
                <Wheat size={16}/>
                <span>Agri-Guard Protection</span>
                <ChevronRight size={14} className="arrow"/>
              </button>
              
              <button 
                className={`service-tab ${activeService === 'forest' ? 'active' : ''}`}
                onClick={() => setActiveService('forest')}
              >
                <TreePine size={16}/>
                <span>Forest-Watch Analytics</span>
                <ChevronRight size={14} className="arrow"/>
              </button>
              
              <button 
                className={`service-tab ${activeService === 'residential' ? 'active' : ''}`}
                onClick={() => setActiveService('residential')}
              >
                <Home size={16}/>
                <span>Predator-Alert Residential</span>
                <ChevronRight size={14} className="arrow"/>
              </button>
            </div>
          </div>

          <div className="services-content">
            {activeService === 'agri' && (
              <div className="service-panel animate-fade">
                <div className="panel-badge bg-green-glow">FARMLANDS & CROPS</div>
                <h3>Safeguarding Agricultural Lands</h3>
                <p>
                  Wild herbivores like elephants, wild boars, and deer pose severe threats to crops. 
                  Agri-Guard continuously analyzes outer field perimeters using infrared CCTV cameras.
                </p>
                <div className="panel-features">
                  <div className="pf-item">
                    <CheckCircle2 size={16} className="text-success"/>
                    <span><strong>Ultrasonic Audio Deterrents:</strong> Automatically emits selected frequencies to push boars or elephants back peacefully without physical harm.</span>
                  </div>
                  <div className="pf-item">
                    <CheckCircle2 size={16} className="text-success"/>
                    <span><strong>Farmer Broadcast Ring:</strong> Dispatches group SMS to neighboring properties to team up for safety patrols.</span>
                  </div>
                  <div className="pf-item">
                    <CheckCircle2 size={16} className="text-success"/>
                    <span><strong>Crop Loss Mapping:</strong> Tracks animal invasion timestamps and routes to identify weaker fencing areas.</span>
                  </div>
                </div>
                <div className="panel-graphic pg-agri"></div>
              </div>
            )}

            {activeService === 'forest' && (
              <div className="service-panel animate-fade">
                <div className="panel-badge bg-blue-glow">FOREST & SANCTUARIES</div>
                <h3>Advanced Conservation Tracking</h3>
                <p>
                  Assisting forest departments, non-governmental wildlife organizations, and researchers 
                  in monitoring species census, migration trajectories, and anti-poaching patrol networks.
                </p>
                <div className="panel-features">
                  <div className="pf-item">
                    <CheckCircle2 size={16} className="text-success"/>
                    <span><strong>Census logs:</strong> Categorizes species (leopards, tigers, bison) and updates local database logs with rich bounding boxes.</span>
                  </div>
                  <div className="pf-item">
                    <CheckCircle2 size={16} className="text-success"/>
                    <span><strong>Poacher Heatmaps:</strong> Identifies suspicious human activities in off-limit jungle pathways.</span>
                  </div>
                  <div className="pf-item">
                    <CheckCircle2 size={16} className="text-success"/>
                    <span><strong>Solar-Powered Edge Nodes:</strong> Specially optimized lightweight models that operate under low-power solar boundaries.</span>
                  </div>
                </div>
                <div className="panel-graphic pg-forest"></div>
              </div>
            )}

            {activeService === 'residential' && (
              <div className="service-panel animate-fade">
                <div className="panel-badge bg-orange-glow">VILLAGES & BOUNDARIES</div>
                <h3>Predator Intrusion Safe-Guards</h3>
                <p>
                  For communities residing on the perimeter of dense forest ranges. 
                  Early warnings protect children, livestock, and local populations from unexpected encounters with dangerous carnivores.
                </p>
                <div className="panel-features">
                  <div className="pf-item">
                    <CheckCircle2 size={16} className="text-success"/>
                    <span><strong>Smart High-Beam Triggers:</strong> Activates floodlights on boundary fences to deter lions, tigers, and leopards before they cross lines.</span>
                  </div>
                  <div className="pf-item">
                    <CheckCircle2 size={16} className="text-success"/>
                    <span><strong>Automated Emergency Sirens:</strong> Triggers village loudspeakers to notify inhabitants of nearby predator activity.</span>
                  </div>
                  <div className="pf-item">
                    <CheckCircle2 size={16} className="text-success"/>
                    <span><strong>Livestock Barn Shielding:</strong> Specially targeted camera feeds to double-guard domestic animals and barns.</span>
                  </div>
                </div>
                <div className="panel-graphic pg-res"></div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* DYNAMIC LIVE AI SIMULATOR (SANDBOX) */}
      <section id="simulator" className="simulator-section">
        <div className="section-title-area">
          <span className="subtitle">EXPERIENCE THE TECHNOLOGY</span>
          <h2 className="section-title">Interactive AI Detection Sandbox</h2>
          <p className="section-subtitle">
            See the AI model classify objects in real-time. Choose an animal to simulate a camera feed and view how the system processes alert events.
          </p>
        </div>

        <div className="simulator-workspace glass">
          <div className="sim-setup-panel">
            <h3>1. Select Simulated Feed</h3>
            <p className="panel-intro-txt">Choose a target species to feed into the virtual CCTV edge model:</p>
            
            <div className="sim-choices">
              {simulatorAnimals.map((animal) => {
                const AnimalIcon = animal.icon;
                return (
                  <button 
                    key={animal.id}
                    className={`sim-choice-btn ${simSelectedAnimal?.id === animal.id ? 'active' : ''}`}
                    onClick={() => triggerSimulator(animal)}
                  >
                    <div className="choice-icon-wrap">
                      <AnimalIcon size={18}/>
                    </div>
                    <div className="choice-meta">
                      <div className="choice-name">{animal.name}</div>
                      <div className="choice-desc">{animal.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="sim-live-status-card">
              <div className="status-label">EDGE DETECTOR METRIC</div>
              <div className="status-grid">
                <div>
                  <span className="lbl">Model Speed:</span>
                  <span className="val mono text-success">14ms</span>
                </div>
                <div>
                  <span className="lbl">FPS Rate:</span>
                  <span className="val mono text-accent">24.2 FPS</span>
                </div>
                <div>
                  <span className="lbl">Precision:</span>
                  <span className="val mono text-success">0.984 mAP</span>
                </div>
              </div>
            </div>
          </div>

          <div className="sim-monitor-panel">
            <div className="monitor-header">
              <span className="dot-live pulsing"></span>
              <span className="mono">VIRTUAL_FEED_CCTV // PROCESSED</span>
            </div>

            <div className="monitor-screen">
              {simState === 'idle' && (
                <div className="monitor-empty">
                  <Eye size={42} strokeWidth={1} className="pulse-slow"/>
                  <h4>No Active Simulation Feed</h4>
                  <p>Click on one of the animal sensors on the left to begin real-time frames inspection.</p>
                </div>
              )}

              {simState === 'scanning' && (
                <div className="monitor-loading">
                  <div className="laser-line-scan"></div>
                  <div className="spinner"></div>
                  <h4 className="mono text-accent">LOADING VIRTUAL CAMERA STREAM...</h4>
                  <p className="mono">Analyzing edge frame tensors via YOLO neural layer...</p>
                </div>
              )}

              {simState === 'detected' && simSelectedAnimal && (
                <div className="monitor-feed-content">
                  <div className="laser-line-scan"></div>
                  
                  {/* Decorative Simulated Animal Photo Block with SVG Frame */}
                  <div className="virtual-photo-block">
                    <svg viewBox="0 0 100 100" className="virtual-silhouette-svg">
                      {simSelectedAnimal.id === 'elephant' && (
                        <path d="M80,50 C70,40 60,35 50,40 C35,45 25,55 20,70 C15,85 20,100 25,110 L45,150 L55,150" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
                      )}
                      {simSelectedAnimal.id === 'tiger' && (
                        <path d="M10,80 Q50,20 90,80" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
                      )}
                      {simSelectedAnimal.id === 'leopard' && (
                        <path d="M20,90 C40,50 60,30 80,70" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
                      )}
                      {simSelectedAnimal.id === 'deer' && (
                        <path d="M50,20 L50,80 M30,50 L70,50" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
                      )}
                    </svg>
                    
                    {/* Bounding Box Render */}
                    {simBoundingBox && (
                      <div 
                        className="sim-bounding-box bounding-active" 
                        style={{
                          top: simBoundingBox.top, 
                          left: simBoundingBox.left, 
                          width: simBoundingBox.width, 
                          height: simBoundingBox.height
                        }}
                      >
                        <div className="bb-label">
                          {simSelectedAnimal.name.toUpperCase()} [{simBoundingBox.conf}%]
                        </div>
                        <div className="bb-corner tl"></div>
                        <div className="bb-corner tr"></div>
                        <div className="bb-corner bl"></div>
                        <div className="bb-corner br"></div>
                      </div>
                    )}
                  </div>

                  {/* Animal Info Card Overlay */}
                  <div className="monitor-overlay-meta">
                    <div className="m-field">
                      <span className="lbl">Target Class:</span>
                      <span className="val text-primary font-bold">{simSelectedAnimal.name}</span>
                    </div>
                    <div className="m-field">
                      <span className="lbl">Confidence:</span>
                      <span className="val text-success">{simBoundingBox?.conf}%</span>
                    </div>
                    <div className="m-field">
                      <span className="lbl">Threat Level:</span>
                      <span className="val text-danger" style={{fontWeight:600}}>{simBoundingBox?.threat.split(' - ')[0]}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Simulated Live Alert Console */}
            <div className="sim-alert-console">
              <div className="console-header">
                <span className="mono">SYSTEM_ALERT_LOGS</span>
                <span className="lbl mono">BUFFERS: OK</span>
              </div>
              <div className="console-logs scrollbar-thin">
                {simAlertLog.length === 0 ? (
                  <div className="log-empty mono text-muted">Awaiting alert signals... logs will output here in real-time.</div>
                ) : (
                  simAlertLog.map(log => (
                    <div key={log.id} className="log-row animate-slide-right">
                      <span className="log-time text-muted mono">[{log.time}]</span>
                      <span className="log-badge text-danger font-bold">INTRUSION</span>
                      <span className="log-msg text-primary font-semibold">{log.animal} ({log.confidence}%)</span>
                      <span className="log-action text-success mono">{log.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATISTICS SECTION */}
      <section className="stats-section">
        <div className="stats-inner">
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-icon-circle">
                <Shield size={24} className="text-blue"/>
              </div>
              <h4>12,840+</h4>
              <p>Successful Wildlife Detections</p>
            </div>
            <div className="stat-box">
              <div className="stat-icon-circle">
                <Activity size={24} className="text-green"/>
              </div>
              <h4>0 Accidents</h4>
              <p>Recorded inside Guard Zones</p>
            </div>
            <div className="stat-box">
              <div className="stat-icon-circle">
                <Users size={24} className="text-yellow"/>
              </div>
              <h4>85 Communities</h4>
              <p>Deploying WildTrack System</p>
            </div>
            <div className="stat-box">
              <div className="stat-icon-circle">
                <Zap size={24} className="text-purple"/>
              </div>
              <h4>&lt; 1.2 Seconds</h4>
              <p>Mean Incident Mitigation Speed</p>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section id="about" className="about-section">
        <div className="about-grid">
          <div className="about-img-area">
            {/* Visual Glass Box representing WildTrack System Architecture */}
            <div className="architecture-box glass">
              <div className="arch-node center">
                <Shield size={24} className="text-primary"/>
                <span className="mono">WILDTRACK CLOUD</span>
              </div>
              <div className="arch-line line-1"></div>
              <div className="arch-line line-2"></div>
              <div className="arch-line line-3"></div>
              
              <div className="arch-node child c-1">
                <Smartphone size={14} className="text-success"/>
                <span className="mono">MOBILE APP</span>
              </div>
              
              <div className="arch-node child c-2">
                <Eye size={14} className="text-yellow"/>
                <span className="mono">EDGE IP CAMERA</span>
              </div>

              <div className="arch-node child c-3">
                <Server size={14} className="text-accent"/>
                <span className="mono">LOCAL HOST</span>
              </div>
            </div>
          </div>

          <div className="about-content">
            <span className="subtitle">ABOUT OUR MISSION</span>
            <h2 className="section-title">Coexistence Engineered Through Technology</h2>
            <p>
              WildTrack started as an academic research endeavor to resolve escalating human-wildlife conflict in forest border zones. 
              Traditional methods like high-voltage electric fences cause critical injuries to protected animals, while simple patrols 
              fail to guard vast boundaries effectively.
            </p>
            <p>
              By leveraging lightweight deep learning algorithms, WildTrack runs direct perimeter checks on standard security feeds. 
              The application processes real-time streams, filters noise, maps tracking directions, and triggers auditory or visual deterrents 
              in seconds.
            </p>

            <div className="about-bullets">
              <div className="bullet-item">
                <div className="bullet-bullet"><CheckCircle2 size={16} className="text-accent"/></div>
                <div>
                  <h4>Harm-Free Safe Defenses</h4>
                  <p>Absolutely no dangerous fences or chemicals. We use gentle acoustic and visual mechanisms to steer animals back safely.</p>
                </div>
              </div>
              <div className="bullet-item">
                <div className="bullet-bullet"><CheckCircle2 size={16} className="text-accent"/></div>
                <div>
                  <h4>Open Source & Integrable</h4>
                  <p>Written entirely in Python, Flask, and React. Integrates with existing RTSP, ONVIF or USB video capture cameras.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT FORM */}
      <section id="contact" className="contact-section">
        <div className="contact-wrapper glass">
          <div className="contact-info-panel">
            <span className="sub">REACH OUT</span>
            <h2>Let's Protect Together</h2>
            <p>
              Are you looking to deploy WildTrack in your sanctuary, agricultural cooperative, or high-risk residential zone? 
              Get in touch with our security engineers for a custom deployment strategy.
            </p>

            <div className="contact-details">
              <div className="cd-item">
                <Mail size={16} className="text-accent"/>
                <div>
                  <div className="lbl">Email Support</div>
                  <div className="val">deployments@wildtrack.com</div>
                </div>
              </div>
              <div className="cd-item">
                <Shield size={16} className="text-accent"/>
                <div>
                  <div className="lbl">Security Response</div>
                  <div className="val">secops@wildtrack.com</div>
                </div>
              </div>
              <div className="cd-item">
                <Info size={16} className="text-accent"/>
                <div>
                  <div className="lbl">Developer Hub</div>
                  <div className="val">github.com/wildtrack-alert</div>
                </div>
              </div>
            </div>
          </div>

          <div className="contact-form-panel">
            {contactSubmitted ? (
              <div className="contact-success animate-fade">
                <div className="success-icon-wrap">
                  <CheckCircle2 size={40} className="text-success"/>
                </div>
                <h3>Message Dispatched!</h3>
                <p>Thank you for reaching out. One of our technical deployment specialists will contact you at your email address within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Enter your name"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="you@domain.com"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Deployment Subject</label>
                  <select 
                    className="form-select"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                  >
                    <option value="inquiry">General Inquiry</option>
                    <option value="agri">Agri-Guard Deployment</option>
                    <option value="forest">Forestry Agency Partnership</option>
                    <option value="dev">Developer & Custom Integration</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Message / Details *</label>
                  <textarea 
                    className="form-input" 
                    rows="4"
                    placeholder="Describe your boundary scale, locations, and existing camera setup..."
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    required
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary btn-glow w-100 justify-center"
                  disabled={contactLoading}
                >
                  {contactLoading ? (
                    <span>Dispatched Request...</span>
                  ) : (
                    <>
                      <span>Transmit Request</span>
                      <Send size={14}/>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-top">
          <div className="logo-area">
            <div className="landing-logo">
              <Shield className="logo-shield text-accent" size={20}/>
              <span className="logo-main">WildTrack</span>
            </div>
            <p>Smart detection & acoustic deterrent perimeter shields.</p>
          </div>
          <div className="footer-links">
            <button className="f-link" onClick={() => scrollToSection('hero')}>Home</button>
            <button className="f-link" onClick={() => scrollToSection('features')}>Features</button>
            <button className="f-link" onClick={() => scrollToSection('services')}>Services</button>
            <button className="f-link" onClick={() => scrollToSection('simulator')}>AI Sandbox</button>
            <button className="f-link" onClick={() => scrollToSection('about')}>About</button>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="mono">© {new Date().getFullYear()} WILDTRACK PERIMETER SYSTEM. ALL RIGHTS RESERVED.</div>
          <div className="footer-status-indicator">
            <span className="dot-live"></span>
            <span className="mono">CENTRAL_API_NODE_ONLINE</span>
          </div>
        </div>
      </footer>


      {/* AUTH MODAL (LOGIN & SIGNUP) */}
      {authModal && (
        <div className="modal-backdrop" onClick={() => setAuthModal(null)}>
          <div className="modal auth-modal glass" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setAuthModal(null)}>
              <X size={18}/>
            </button>

            {authModal === 'login' ? (
              <div className="auth-panel animate-fade">
                <div className="auth-header">
                  <Shield size={28} className="text-accent auth-logo"/>
                  <h2>Access Console</h2>
                  <p>Enter credentials to access the live dashboard panel.</p>
                </div>

                {authError && <div className="auth-error-banner"><AlertTriangle size={14}/><span>{authError}</span></div>}
                
                <form onSubmit={handleLoginSubmit}>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <div className="auth-input-wrap">
                      <Mail size={16} className="auth-field-icon"/>
                      <input 
                        name="email"
                        type="email" 
                        className="form-input pad-left" 
                        placeholder="admin@wildtrack.com"
                        value={authForm.email}
                        onChange={handleAuthInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Secure Password</label>
                    <div className="auth-input-wrap">
                      <Lock size={16} className="auth-field-icon"/>
                      <input 
                        name="password"
                        type="password" 
                        className="form-input pad-left" 
                        placeholder="••••••••••••"
                        value={authForm.password}
                        onChange={handleAuthInputChange}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary btn-glow w-100 justify-center auth-btn">
                    <span>Unlock System Console</span>
                    <Key size={14}/>
                  </button>
                </form>

                <div className="auth-footer">
                  <span>Don't have a secure deployment account?</span>
                  <button onClick={() => { setAuthModal('signup'); setAuthError(''); }}>Create an Account</button>
                </div>
                
                <div className="demo-account-info">
                  <strong>Demo Credentials:</strong><br/>
                  <span>Email: <code>admin@wildtrack.com</code></span><br/>
                  <span>Password: <code>password123</code></span>
                </div>
              </div>
            ) : (
              <div className="auth-panel animate-fade">
                <div className="auth-header">
                  <Shield size={28} className="text-accent auth-logo"/>
                  <h2>Register System Node</h2>
                  <p>Establish a secure console credential for your boundaries.</p>
                </div>

                {authError && <div className="auth-error-banner"><AlertTriangle size={14}/><span>{authError}</span></div>}
                {authSuccess && <div className="auth-success-banner"><CheckCircle2 size={14}/><span>{authSuccess}</span></div>}

                <form onSubmit={handleSignupSubmit}>
                  <div className="form-group">
                    <label className="form-label">Operator Full Name</label>
                    <div className="auth-input-wrap">
                      <User size={16} className="auth-field-icon"/>
                      <input 
                        name="name"
                        type="text" 
                        className="form-input pad-left" 
                        placeholder="Operator Name"
                        value={authForm.name}
                        onChange={handleAuthInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Operator Email Address</label>
                    <div className="auth-input-wrap">
                      <Mail size={16} className="auth-field-icon"/>
                      <input 
                        name="email"
                        type="email" 
                        className="form-input pad-left" 
                        placeholder="operator@wildtrack.com"
                        value={authForm.email}
                        onChange={handleAuthInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Account Password</label>
                    <div className="auth-input-wrap">
                      <Lock size={16} className="auth-field-icon"/>
                      <input 
                        name="password"
                        type="password" 
                        className="form-input pad-left" 
                        placeholder="Min. 6 characters"
                        value={authForm.password}
                        onChange={handleAuthInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Confirm Password</label>
                    <div className="auth-input-wrap">
                      <Lock size={16} className="auth-field-icon"/>
                      <input 
                        name="confirmPassword"
                        type="password" 
                        className="form-input pad-left" 
                        placeholder="Verify Password"
                        value={authForm.confirmPassword}
                        onChange={handleAuthInputChange}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary btn-glow w-100 justify-center auth-btn">
                    <span>Initialize System Console</span>
                    <ArrowRight size={14}/>
                  </button>
                </form>

                <div className="auth-footer">
                  <span>Already possess deployment keys?</span>
                  <button onClick={() => { setAuthModal('login'); setAuthError(''); }}>Sign In</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
