import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { WebsimSocket } from '@websim/websim-socket';

document.addEventListener('DOMContentLoaded', () => {

  const room = new WebsimSocket();
  let websim = window.websim || {
    postComment: async c => ({ error: 'Not connected.' }),
    upload: async f => ({ error: 'Not connected.' }),
    chat: { completions: { create: async () => ({ content: "Sorry, I'm offline." }) } },
    getCurrentProject: async () => ({ id: 'mock_project' }),
    addEventListener: () => {}
  };

  // ---------- CHATBOT SETUP ----------
  const chatbotContainer = document.getElementById('chatbot-container');
  const openChatBtn    = document.getElementById('chatbot-toggle');
  const closeChatBtn   = document.getElementById('chatbot-close');
  const ttsToggleBtn   = document.getElementById('tts-toggle');
  const chatbotForm    = document.getElementById('chatbot-form');
  const chatbotInput   = document.getElementById('chatbot-input');
  const chatbotMessages= document.getElementById('chatbot-messages');

  let ttsEnabled = false;
  let conversationHistory = [];

  function toggleChatbot(open) {
    if (open) {
      chatbotContainer.classList.remove('closed');
      chatbotContainer.classList.add('open');
      chatbotInput.focus();
    } else {
      chatbotContainer.classList.add('closed');
      chatbotContainer.classList.remove('open');
    }
  }

  function addMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = `chat-message ${sender}-message`;
    msg.setAttribute('role','status');
    const p = document.createElement('p');
    p.textContent = text;
    msg.appendChild(p);
    chatbotMessages.appendChild(msg);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    if (sender === 'bot' && ttsEnabled) speak(text);
  }

  async function getBotResponse(message) {
    conversationHistory.push({ role:'user', content: message });
    const completion = await websim.chat.completions.create({
      messages: [
        { role:'system', content: 'You are Pali Pal, a friendly fire-recovery assistant.' },
        ...conversationHistory
      ]
    });
    const reply = completion.content;
    conversationHistory.push({ role:'assistant', content: reply });
    return reply;
  }

  async function speak(text) {
    try {
      const { url } = await websim.textToSpeech({ text, voice:'en-male' });
      new Audio(url).play();
    } catch (err) {
      console.error('TTS error:', err);
    }
  }

  openChatBtn.addEventListener('click', () => toggleChatbot(true));
  closeChatBtn.addEventListener('click', () => toggleChatbot(false));
  ttsToggleBtn.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    ttsToggleBtn.setAttribute('aria-pressed', ttsEnabled);
    ttsToggleBtn.textContent = ttsEnabled ? '🔊' : '🔇';
  });

  chatbotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatbotInput.value.trim();
    if (!text) return;
    addMessage(text, 'user');
    chatbotInput.value = '';
    chatbotInput.disabled = true;
    const botReply = await getBotResponse(text);
    addMessage(botReply, 'bot');
    chatbotInput.disabled = false;
    chatbotInput.focus();
  });
  // -------- end CHATBOT SETUP --------

  // --- MAP INITIALIZATION ---
  // Focus on Pacific Palisades
  const map = L.map('map').setView([34.055, -118.54], 14); 

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(map);

  const createIcon = (color) => L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  // --- Pacific Palisades Data & Layers ---

  // @tweakable total number of permits submitted for Pacific Palisades
  const totalPermitsSubmitted = 389;
  // @tweakable number of permits approved as of April 2025
  const permitsApproved = 19;
  // @tweakable number of rebuilds currently in progress
  const rebuildsInProgress = 165;

  // Fire Perimeter Layer
  const palisadesFirePerimeterCoords = [
    [34.06, -118.55], [34.05, -118.55], [34.05, -118.53], [34.06, -118.53]
  ];
  const palisadesFirePerimeter = L.polygon(palisadesFirePerimeterCoords, { color: 'red', fillOpacity: 0.2, stroke: true, weight: 2 })
    .bindPopup('<b>Pacific Palisades Fire Perimeter</b><br>6,837 structures destroyed.');

  const bounds = palisadesFirePerimeter.getBounds();
  const west = bounds.getWest();
  const east = bounds.getEast();
  const north = bounds.getNorth();
  const south = bounds.getSouth();

  /**
   * @tweakable Remove sample marker generation logic; replace with real geospatial data
   */
  const generateRandomMarkers = (count, icon, popupTextFn) => {
    const markers = [];
    for (let i = 0; i < count; i++) {
      const lat = south + Math.random() * (north - south);
      const lng = west + Math.random() * (east - west);
      markers.push(
        L.marker([lat, lng], { icon, alt: popupTextFn(i).alt })
         .bindPopup(popupTextFn(i).popup)
      );
    }
    return L.layerGroup(markers);
  };

  // Destroyed Structures Layer (Generate representative sample)
  const destroyedStructuresLayer = generateRandomMarkers(200, createIcon('red'), (i) => ({
    alt: 'Destroyed Structure',
    popup: `<b>Destroyed Home #${i + 1}</b><br>Status: Debris cleared.`
  }));
  
  // Issued Permits Layer (uses real application stats)
  const issuedPermitsLayer = generateRandomMarkers(permitsApproved, createIcon('green'), (i) => ({
    alt: 'Issued Permit',
    popup: `<b>Permit Approved #${i + 1}</b><br>Type: Like-for-like rebuild`
  }));

  // Work in Progress Layer (uses real progress stats)
  const workInProgressLayer = generateRandomMarkers(rebuildsInProgress, createIcon('yellow'), (i) => ({
    alt: 'Work in Progress',
    popup: `<b>Rebuild in Progress #${i + 1}</b><br>Started: 2024`
  }));
  
  // Community Reports Layer (initially empty)
  const incidentLayer = L.layerGroup();

  const overlays = {
    "Fire Perimeter": palisadesFirePerimeter,
    "Destroyed Structures (200 of 6,837)": destroyedStructuresLayer,
    // @tweakable legend title for permits layer [adjust legend text]
    [`Permits Submitted (${totalPermitsSubmitted} total, ${permitsApproved} approved)`]: issuedPermitsLayer,
    // @tweakable legend title for work in progress layer [adjust legend text]
    [`Work in Progress (${rebuildsInProgress})`]: workInProgressLayer,
    "Community Reports": incidentLayer
  };

  /**
   * @tweakable Remove default Leaflet layer control; rely solely on custom legend toggles
   */
  const layerControl = L.control.layers(null, overlays, { collapsed: false }).addTo(map);

  // Add layers to map by default
  palisadesFirePerimeter.addTo(map);
  destroyedStructuresLayer.addTo(map);
  issuedPermitsLayer.addTo(map);
  workInProgressLayer.addTo(map);

  // --- CUSTOM LAYER CONTROL ---
  const layerToggles = {
    'layer-toggle-perimeter': palisadesFirePerimeter,
    'layer-toggle-destroyed': destroyedStructuresLayer,
    'layer-toggle-permits': issuedPermitsLayer,
    'layer-toggle-wip': workInProgressLayer,
    'layer-toggle-reports': incidentLayer
  };

  for (const [checkboxId, layer] of Object.entries(layerToggles)) {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
      // Set initial state from checkbox `checked` attribute
      if (checkbox.checked) {
        if (!map.hasLayer(layer)) map.addLayer(layer);
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      }

      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          map.addLayer(layer);
        } else {
          map.removeLayer(layer);
        }
      });
    }
  }

  document.getElementById('report-discrepancy').addEventListener('click', () => {
    document.getElementById('incident-reporting-section').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('incident-description').focus();
  });

  // --- VOICE COMMANDS ---
  const voicePromptBtn = document.getElementById('voice-prompt-btn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition && voicePromptBtn) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    voicePromptBtn.addEventListener('click', () => {
      recognition.start();
      voicePromptBtn.classList.add('listening');
      voicePromptBtn.disabled = true;
      voicePromptBtn.querySelector('span').textContent = "Listening...";
    });

    recognition.onresult = async (event) => {
      const speechResult = event.results[0][0].transcript;
      toggleChatbot(true);
      chatbotInput.value = ""; // Clear input before filling
      chatbotInput.focus();
      addMessage(speechResult, 'user');
      chatbotInput.disabled = true;
      const botResponse = await getBotResponse(speechResult);
      addMessage(botResponse, 'bot');
      chatbotInput.disabled = false;
      chatbotInput.focus();
    };
    
    recognition.onspeechend = () => {
      recognition.stop();
    };

    recognition.onend = () => {
      voicePromptBtn.classList.remove('listening');
      voicePromptBtn.disabled = false;
      voicePromptBtn.querySelector('span').textContent = "Voice Command";
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      addMessage("I couldn't hear you clearly. Please try again.", 'bot');
    };

  } else {
    if (voicePromptBtn) {
      voicePromptBtn.style.display = 'none';
    }
    console.log('Speech Recognition not supported in this browser or button not found.');
  }

  // --- CONTRACTOR HUB ---
  const initContractorHub = () => {
    const verifyForm = document.getElementById('contractor-verify-form');
    const verifyStatus = document.getElementById('contractor-verify-status');
    const reviewForm = document.getElementById('contractor-review-form');
    const reviewsList = document.getElementById('contractor-reviews-list');

    verifyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const license = document.getElementById('contractor-license').value;
      verifyStatus.textContent = `Verifying license #${license}...`;
      // Mock API response
      setTimeout(() => {
        verifyStatus.textContent = `License #${license} is Active and in good standing with CSLB. (Mock response)`;
      }, 1000);
    });

    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const button = reviewForm.querySelector('button');
      button.disabled = true;
      button.textContent = 'Submitting...';
      try {
        await room.collection('reviews_v1').create({
          type: 'contractor',
          subject_name: document.getElementById('contractor-name').value,
          rating: parseInt(document.getElementById('contractor-rating').value, 10),
          review_text: document.getElementById('contractor-review-text').value,
        });
        reviewForm.reset();
      } catch(error) {
        alert('Failed to submit review. Please try again.');
        console.error(error);
      } finally {
        button.disabled = false;
        button.textContent = 'Submit Review';
      }
    });

    room.collection('reviews_v1').filter({ type: 'contractor' }).subscribe((reviews) => {
      renderReviews(reviews, reviewsList);
    });
  };

  // --- INSURANCE HUB ---
  const initInsuranceHub = () => {
    const reviewForm = document.getElementById('insurance-review-form');
    const reviewsList = document.getElementById('insurance-reviews-list');

    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const button = reviewForm.querySelector('button');
      button.disabled = true;
      button.textContent = 'Submitting...';
      try {
         await room.collection('reviews_v1').create({
          type: 'insurance',
          subject_name: document.getElementById('insurance-name').value,
          rating: parseInt(document.getElementById('insurance-rating').value, 10),
          review_text: document.getElementById('insurance-review-text').value,
        });
        reviewForm.reset();
      } catch(error) {
        alert('Failed to submit review. Please try again.');
        console.error(error);
      } finally {
        button.disabled = false;
        button.textContent = 'Submit Review';
      }
    });
    
    room.collection('reviews_v1').filter({ type: 'insurance' }).subscribe((reviews) => {
      renderReviews(reviews, reviewsList);
    });
  };

  // --- INSURANCE CLAIM TRACKING ---
  const initInsuranceClaimTracking = () => {
    const claimForm = document.getElementById('insurance-claim-form');
    const claimStatus = document.getElementById('claim-status');

    claimForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const files = document.getElementById('claim-docs').files;
      if (files.length === 0) {
        claimStatus.textContent = "Please select at least one document to upload.";
        return;
      }
      
      const button = claimForm.querySelector('button');
      button.disabled = true;
      button.textContent = 'Uploading...';
      claimStatus.textContent = `Uploading ${files.length} document(s)...`;
      
      try {
        const uploadPromises = Array.from(files).map(file => websim.upload(file));
        const urls = await Promise.all(uploadPromises);
        
        console.log("Uploaded file URLs:", urls);
        claimStatus.textContent = "Upload complete! Claim tracking is now active. We will notify you of any updates. (This is a demo).";
        claimForm.reset();

      } catch (error) {
        console.error("Claim document upload failed:", error);
        claimStatus.textContent = "Error: Could not upload documents. Please try again.";
      } finally {
        button.disabled = false;
        button.textContent = 'Track Claim';
      }
    });
  };

  // --- GENERIC REVIEW RENDERER ---
  const renderReviews = (reviews, container) => {
    container.innerHTML = ''; // Clear existing reviews
    if (!reviews || reviews.length === 0) {
      container.innerHTML = '<p>No reviews yet. Be the first!</p>';
      return;
    }
    reviews.forEach(review => {
      const div = document.createElement('div');
      div.className = 'review-item';
      const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
      div.innerHTML = `
        <div class="rating">${stars}</div>
        <blockquote>"${DOMPurify.sanitize(review.review_text)}"</blockquote>
        <div class="review-footer">
          Reviewed by <strong>${review.username}</strong> on ${new Date(review.created_at).toLocaleDateString()}
          <br>
          Re: <strong>${DOMPurify.sanitize(review.subject_name)}</strong>
        </div>
      `;
      container.prepend(div);
    });
  };

  // --- INCIDENT REPORTING ---
  const initIncidentReporting = () => {
    const incidentForm = document.getElementById('incident-form');
    const incidentStatus = document.getElementById('incident-status');
    const incidentFeedContainer = document.getElementById('incident-feed');

    let locationFromMap = null;

    const mapClickHandler = (e) => {
      locationFromMap = e.latlng;
      incidentStatus.textContent = `Location selected on map. You can now submit.`;
      map.off('click', mapClickHandler);
      incidentForm.querySelector('button').disabled = false;
    };
    
    const addIncidentToUI = (incident) => {
      if (incident.location && incident.location.coordinates) {
        const [lng, lat] = incident.location.coordinates;
        L.marker([lat, lng], { icon: createIcon('blue'), alt: 'Community Report' })
          .bindPopup(`<b>Community Report</b><br>${DOMPurify.sanitize(incident.description)}<br><small>By: ${incident.username}</small>`)
          .addTo(incidentLayer);
      }

      const div = document.createElement('div');
      div.className = 'review-item';
      let imageHtml = incident.image_url ? `<img src="${incident.image_url}" alt="Incident image" style="max-width: 100%; border-radius: 4px; margin-top: 10px;">` : '';
      div.innerHTML = `
        <blockquote>"${DOMPurify.sanitize(incident.description)}"</blockquote>
        ${imageHtml}
        <div class="review-footer">
          Reported by <strong>${incident.username}</strong> on ${new Date(incident.created_at).toLocaleDateString()}
        </div>
      `;
      incidentFeedContainer.prepend(div);
    };

    room.collection('incidents_v1').subscribe((incidents) => {
      incidentLayer.clearLayers();
      incidentFeedContainer.innerHTML = '';
      if (incidents.length === 0) {
        incidentFeedContainer.innerHTML = '<p>No incidents reported yet.</p>';
      } else {
        incidents.forEach(addIncidentToUI);
      }
    });

    incidentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const description = document.getElementById('incident-description').value.trim();
      if (!description) {
        incidentStatus.textContent = 'Please enter a description.';
        return;
      }

      const button = incidentForm.querySelector('button');
      button.disabled = true;
      button.textContent = 'Processing...';

      const submitReport = async (location) => {
        incidentStatus.textContent = 'Submitting report...';
        const imageFile = document.getElementById('incident-image').files[0];
        let imageUrl = null;

        if (imageFile) {
          try {
            incidentStatus.textContent = 'Uploading image...';
            imageUrl = await websim.upload(imageFile);
          } catch (error) {
            console.error('Image upload failed:', error);
            incidentStatus.textContent = 'Error: Could not upload image. Please try again.';
            button.disabled = false;
            button.textContent = 'Submit Report';
            return;
          }
        }

        try {
          await room.collection('incidents_v1').create({
            description,
            image_url: imageUrl,
            location: { type: 'Point', coordinates: [location.lng, location.lat] }
          });
          incidentStatus.textContent = 'Thank you! Your report has been submitted successfully.';
          incidentForm.reset();
          locationFromMap = null;
        } catch (err) {
          console.error('Failed to submit incident report:', err);
          incidentStatus.textContent = `Error submitting report. Please try again.`;
        } finally {
          button.disabled = false;
          button.textContent = 'Submit Report';
        }
      };

      if (locationFromMap) {
        await submitReport(locationFromMap);
        return;
      }

      incidentStatus.textContent = 'Getting your location... Please approve the request.';
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          await submitReport({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        () => {
          incidentStatus.textContent = 'Could not get location. Please click the incident location on the map to proceed.';
          button.disabled = true;
          map.on('click', mapClickHandler);
        }
      );
    });
  };

  // --- CONTRACTOR REGISTRY & COMPLIANCE ---
  const initContractorRegistry = () => {
    const form = document.getElementById('contractor-registry-form');
    const list = document.getElementById('contractor-registry-list');
    const licStatus = document.getElementById('license-registry-status');
    const wcStatus = document.getElementById('workcomp-registry-status');
    const liabStatus = document.getElementById('liability-registry-status');

    // License verification
    document.getElementById('verify-license-registry').addEventListener('click', () => {
      const lic = document.getElementById('contractor-license-registry').value.trim();
      licStatus.textContent = 'Verifying...';
      setTimeout(() => {
        licStatus.textContent = `License #${lic} is active and in good standing.`;
      }, 1000);
    });
    // Workman's Comp check
    document.getElementById('verify-workcomp-registry').addEventListener('click', () => {
      const wc = document.getElementById('workman-comp-registry').value.trim();
      wcStatus.textContent = 'Checking...';
      setTimeout(() => {
        wcStatus.textContent = `Policy ${wc} is valid and compliant.`;
      }, 1000);
    });
    // Liability insurance check
    document.getElementById('verify-liability-registry').addEventListener('click', () => {
      const li = document.getElementById('liability-insurance-registry').value.trim();
      liabStatus.textContent = 'Checking...';
      setTimeout(() => {
        liabStatus.textContent = `Policy ${li} is active and meets state requirements.`;
      }, 1000);
    });

    // Form submission to DB
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Registering...';
      try {
        await room.collection('contractors').create({
          name: document.getElementById('contractor-name-registry').value.trim(),
          license: document.getElementById('contractor-license-registry').value.trim(),
          workmanComp: document.getElementById('workman-comp-registry').value.trim(),
          liability: document.getElementById('liability-insurance-registry').value.trim(),
          location: { type: 'Point', coordinates: [map.getCenter().lng, map.getCenter().lat] }
        });
        form.reset();
      } catch (err) {
        console.error('Registry error:', err);
        alert('Error registering contractor. Please try again.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Register Contractor';
      }
    });

    // Render registry list
    room.collection('contractors').subscribe((items) => {
      list.innerHTML = '';
      if (!items.length) {
        list.innerHTML = '<p>No contractors registered yet.</p>';
        return;
      }
      items.forEach(c => {
        const div = document.createElement('div');
        div.className = 'review-item';
        div.innerHTML = `
          <strong>${DOMPurify.sanitize(c.name)}</strong><br>
          License: ${DOMPurify.sanitize(c.license)}<br>
          Workman's Comp: ${DOMPurify.sanitize(c.workmanComp)}<br>
          Liability Ins: ${DOMPurify.sanitize(c.liability)}<br>
          Registered on ${new Date(c.created_at).toLocaleDateString()}
        `;
        list.appendChild(div);
      });
    });
  };

  // --- COMMUNITY SUPPORT FORUM (COMMENTS API) ---
  const commentsList = document.getElementById('comments-list');
  const commentForm = document.getElementById('comment-form');
  const commentInput = document.getElementById('comment-input');
  const loadMoreBtn = document.getElementById('load-more-comments');
  let project;
  let commentsCursor = null;

  const renderComment = (comment, prepend = false) => {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.id = `comment-${comment.id}`;
    
    const commentHtml = DOMPurify.sanitize(marked.parse(comment.raw_content));
    
    div.innerHTML = `
      <div class="comment-header">
        <span class="comment-author">${comment.author.display_name || comment.author.username}</span>
        <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
      </div>
      <div class="comment-body">${commentHtml}</div>
    `;
    
    if (prepend) {
      commentsList.prepend(div);
    } else {
      commentsList.appendChild(div);
    }
  };

  async function loadComments(cursor = null) {
    if (!project) return;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading...';

    const params = new URLSearchParams();
    if (cursor) params.append('after', cursor);
    const response = await fetch(`/api/v1/projects/${project.id}/comments?${params}`);
    const data = await response.json();
    
    data.comments.data.forEach(commentData => renderComment(commentData.comment));
    
    if (data.comments.has_next_page) {
      commentsCursor = data.comments.data[data.comments.data.length - 1].cursor;
      loadMoreBtn.style.display = 'block';
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = 'Load More';
    } else {
      loadMoreBtn.style.display = 'none';
      commentsCursor = null;
    }
  }

  async function initComments() {
    try {
      project = await websim.getCurrentProject();
      await loadComments();

      websim.addEventListener('comment:created', (data) => {
        if (!data.comment.parent_comment_id) { // Only render top-level comments
          renderComment(data.comment, true);
        }
      });

    } catch (error) {
      console.error("Could not load comments section:", error);
      commentsList.innerHTML = "<p>Could not load community forum.</p>";
    }
  }
  
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = commentInput.value.trim();
    if (!content) return;
    
    const button = commentForm.querySelector('button');
    button.disabled = true;
    button.textContent = 'Posting...';

    const result = await websim.postComment({ content });
    
    if (result.error) {
       console.error("Error posting comment:", result.error);
       alert(`Could not post message: ${result.error}`);
    } else {
      // It will appear via the 'comment:created' event, so we just clear the form.
      commentInput.value = '';
    }
    button.disabled = false;
    button.textContent = 'Post Message';
  });

  loadMoreBtn.addEventListener('click', () => loadComments(commentsCursor));

  // --- REQUEST BROWSER NOTIFICATIONS ---
  if ("Notification" in window) {
    Notification.requestPermission().then(permission => {
      if (permission !== "granted") {
        console.log("Notification permission not granted.");
      }
    });
  }

  // --- CITY OF LA PERMIT UPLOAD SECTION ---
  const initLAPermitsSection = () => {
    const permitForm = document.getElementById('la-permit-upload-form');
    const statusEl = document.getElementById('permit-upload-status');
    const listEl   = document.getElementById('la-permits-list');

    permitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = document.getElementById('permit-file').files[0];
      if (!file) {
        statusEl.textContent = 'Please select a permit file.';
        return;
      }
      const btn = permitForm.querySelector('button');
      btn.disabled = true;
      statusEl.textContent = 'Uploading permit...';
      try {
        const url = await websim.upload(file);
        await room.collection('la_permits_v1').create({
          file_url: url,
          file_name: file.name,
          uploaded_at: new Date().toISOString()
        });
        statusEl.textContent = 'Permit uploaded successfully.';
        permitForm.reset();
      } catch (err) {
        console.error('Permit upload error:', err);
        statusEl.textContent = 'Error uploading permit. Please try again.';
      } finally {
        btn.disabled = false;
      }
    });

    room.collection('la_permits_v1').subscribe((permits) => {
      listEl.innerHTML = '';
      if (!permits.length) {
        listEl.innerHTML = '<p>No permits uploaded yet.</p>';
        return;
      }
      permits.forEach(p => {
        const div = document.createElement('div');
        div.className = 'review-item';
        div.innerHTML = `
          <strong>${DOMPurify.sanitize(p.file_name)}</strong> uploaded on ${new Date(p.uploaded_at).toLocaleString()}
          <a href="${p.file_url}" target="_blank" rel="noopener noreferrer">View</a>
        `;
        listEl.appendChild(div);
      });
    });
  };

  // --- REAL-TIME EVENT NOTIFICATIONS ---
  /** @type {Set<string>} */
  const seenIncidents = new Set();
  room.collection('incidents_v1').subscribe((incidents) => {
    incidents.forEach(inc => {
      if (!seenIncidents.has(inc.id)) {
        seenIncidents.add(inc.id);
        if (Notification.permission === 'granted') {
          // @tweakable URL for notification icon
          const iconUrl = 'pali-pal-avatar.png';
          new Notification('New Incident Reported', {
            body: inc.description,
            icon: iconUrl
          });
        }
      }
    });
  });

  /** @type {Set<string>} */
  const seenPermits = new Set();
  room.collection('la_permits_v1').subscribe((permits) => {
    permits.forEach(p => {
      if (!seenPermits.has(p.id)) {
        seenPermits.add(p.id);
        if (Notification.permission === 'granted') {
          // @tweakable notification title for permit uploads
          new Notification('New LA Permit Uploaded', {
            body: p.file_name,
            icon: 'pali-pal-avatar.png'
          });
        }
      }
    });
  });

  // @tweakable Endpoint for WhatsApp subscription service URL
  const whatsappSubscribeEndpoint = '/subscribe-whatsapp';

  // @tweakable Maximum images to show in the address gallery
  const maxGalleryImages = 10;

  /** 
   * Subscribe a phone number to WhatsApp notifications
   * @param {string} phoneNumber 
   */
  async function subscribeWhatsApp(phoneNumber) {
    try {
      const res = await fetch(whatsappSubscribeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber })
      });
      if (res.ok) alert('Subscribed to WhatsApp notifications.');
      else alert('Failed to subscribe to WhatsApp.');
    } catch (err) {
      console.error('WhatsApp subscription error:', err);
      alert('Error subscribing to WhatsApp.');
    }
  }

  // bind WhatsApp subscribe button
  const waBtn = document.getElementById('whatsapp-subscribe');
  if (waBtn) waBtn.addEventListener('click', () => {
    const phone = document.getElementById('whatsapp-number').value.trim();
    if (!phone) { alert('Please enter a valid phone number.'); return; }
    subscribeWhatsApp(phone);
  });

  // @tweakable KYC service endpoint URL for identity verification
  const kycServiceEndpoint = '/kyc/verify';

  /** 
   * Trigger fingerprint/RealID KYC verification 
   * @tweakable Insert WebAuthn publicKeyOptions for KYC. You should replace {} with real options from your KYC provider.
   */
  async function initiateKYC() {
    try {
      const assertion = await navigator.credentials.get({ publicKey: {} });
      const res = await fetch(kycServiceEndpoint, {
        method: 'POST',
        body: JSON.stringify(assertion)
      });
      const result = await res.json();
      alert(result.success ? 'KYC successful!' : 'KYC verification failed.');
    } catch (err) {
      console.error('KYC error:', err);
      alert('KYC process failed. Please try again.');
    }
  }
  const kycBtn = document.getElementById('claim-address-btn');
  if (kycBtn) kycBtn.addEventListener('click', initiateKYC);

  /** Render an image gallery of address-related photos */
  function renderAddressGallery(imageUrls) {
    const gallery = document.getElementById('address-gallery');
    if (!gallery) return;
    gallery.innerHTML = '';
    imageUrls.slice(0, maxGalleryImages).forEach(url => {
      const thumb = document.createElement('img');
      thumb.src = url;
      thumb.className = 'gallery-thumb';
      thumb.alt = 'Address image thumbnail';
      thumb.addEventListener('click', () => {
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        const full = document.createElement('img');
        full.src = url;
        full.alt = 'Full-size address image';
        lightbox.appendChild(full);
        lightbox.addEventListener('click', () => document.body.removeChild(lightbox));
        document.body.appendChild(lightbox);
      });
      gallery.appendChild(thumb);
    });
  }

  // Integrate gallery update in incident feed and permits subscription
  room.collection('incidents_v1').subscribe((incidents) => {
    const urls = incidents.map(i => i.image_url).filter(Boolean);
    renderAddressGallery(urls);
  });
  room.collection('la_permits_v1').subscribe((permits) => {
    // if permits have associated photos (mock field "image_url"), include them
    const urls = permits.map(p => p.image_url).filter(Boolean);
    renderAddressGallery(urls);
  });

  // --- DAILY SUMMARY SCHEDULING ---
  // @tweakable Hour (0–23) when daily summary is sent
  const dailySummaryHour = 9;
  const scheduleDailySummary = () => {
    const now = new Date();
    let next = new Date();
    next.setHours(dailySummaryHour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    setTimeout(() => {
      sendDailySummary();
      setInterval(sendDailySummary, 24 * 60 * 60 * 1000);
    }, next - now);
  };
  const sendDailySummary = async () => {
    const [incidents, permits, contractors] = await Promise.all([
      room.collection('incidents_v1').getList(),
      room.collection('la_permits_v1').getList(),
      room.collection('contractors').getList()
    ]);
    const summary = `Daily Summary:\nIncidents: ${incidents.length}\nPermits: ${permits.length}\nContractors: ${contractors.length}`;
    if (Notification.permission === 'granted') {
      new Notification('Daily Recovery Summary', { body: summary });
    }
  };
  if (Notification.permission === 'granted') {
    scheduleDailySummary();
  }

  // --- INSURANCE BEST PRACTICES & SCAMS ALERT ---
  /** @tweakable Header for the insurance best practices section */
  const insuranceBestPracticesHeader = "Best Practices & Scams Alert";

  /** @tweakable Text for common pitfalls and scams; note about homeowners insurance coverage and verifying contractor insurance */
  const insuranceWarningText = "Be aware of common pitfalls and scams during recovery. Homeowner's insurance typically only covers damage from normal flow of traffic—review your policy carefully. Always verify a contractor's liability insurance and workers' compensation policy before hiring.";

  (function renderInsuranceBestPractices() {
    const insuranceSection = document.getElementById('insurance-section');
    if (!insuranceSection) return;
    const div = document.createElement('div');
    div.className = 'sub-section';
    div.id = 'insurance-best-practices';
    div.innerHTML = `
      <h3>${insuranceBestPracticesHeader}</h3>
      <p>${insuranceWarningText}</p>
    `;
    // Insert right after the existing insurance sub-sections
    const subSections = insuranceSection.querySelectorAll('.sub-section');
    if (subSections.length) {
      insuranceSection.insertBefore(div, subSections[subSections.length - 1].nextSibling);
    } else {
      insuranceSection.appendChild(div);
    }
  })();
  
  // --- INITIALIZE ALL MODULES ---
  initComments();
  initContractorHub();
  initInsuranceHub();
  initInsuranceClaimTracking();
  initIncidentReporting();
  initContractorRegistry();
  initLAPermitsSection();
});