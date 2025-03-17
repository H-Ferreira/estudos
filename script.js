// Gerenciamento do Checklist
let checklistItems = JSON.parse(localStorage.getItem('checklistItems')) || [];

function addItem() {
    const input = document.getElementById('newItem');
    const materiaSelect = document.getElementById('materiaSelect');
    const text = input.value.trim();
    const materia = materiaSelect.value;
    
    if (!materia) {
        alert('Por favor, selecione uma matéria!');
        return;
    }
    
    if (text) {
        const item = {
            id: Date.now(),
            text: text,
            completed: false,
            materia: materia
        };
        
        checklistItems.push(item);
        saveItems();
        renderChecklist();
        input.value = '';
        materiaSelect.value = '';
    }
}

function toggleItem(id) {
    const item = checklistItems.find(item => item.id === id);
    if (item) {
        item.completed = !item.completed;
        saveItems();
        renderChecklist();
    }
}

function deleteItem(id) {
    const confirmDelete = confirm('Tem certeza que deseja excluir este item da lista de revisão?');
    
    if (confirmDelete) {
        checklistItems = checklistItems.filter(item => item.id !== id);
        saveItems();
        renderChecklist();
    }
}

function filterItems() {
    renderChecklist();
}

function saveItems() {
    localStorage.setItem('checklistItems', JSON.stringify(checklistItems));
    saveBackup();
}

// Sistema de Backup
function saveBackup() {
    const data = {
        checklistItems: checklistItems,
        recordings: recordings,
        lastBackup: new Date().toLocaleString()
    };
    localStorage.setItem('backup_data', JSON.stringify(data));
}

// Função para converter ArrayBuffer para Base64
function arrayBufferToBase64(buffer) {
    const binary = new Uint8Array(buffer);
    const bytes = binary.reduce((data, byte) => data + String.fromCharCode(byte), '');
    return window.btoa(bytes);
}

// Função para converter Base64 para ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function exportData() {
    try {
        // Busca todos os áudios do IndexedDB
        const transaction = db.transaction(['recordings'], 'readonly');
        const store = transaction.objectStore('recordings');
        const recordingsFromDB = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        // Converte ArrayBuffer para Base64 para permitir serialização
        const serializedRecordings = recordingsFromDB.map(recording => ({
            ...recording,
            audioData: arrayBufferToBase64(recording.audioData)
        }));

        const data = {
            checklistItems: checklistItems,
            recordings: serializedRecordings,
            lastBackup: new Date().toLocaleString()
        };
        
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `revisao_backup_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Backup exportado com sucesso!');
    } catch (error) {
        console.error('Erro ao exportar backup:', error);
        alert('Erro ao exportar o backup. Por favor, tente novamente.');
    }
}

async function importData(event) {
    try {
        const file = event.target.files[0];
        if (!file) return;

        const text = await file.text();
        const data = JSON.parse(text);

        // Importa os itens do checklist
        if (data.checklistItems) {
            checklistItems = data.checklistItems;
            localStorage.setItem('checklistItems', JSON.stringify(checklistItems));
            renderChecklist();
        }

        if (data.recordings && data.recordings.length > 0) {
            try {
                // Limpa as gravações existentes no IndexedDB
                const clearTransaction = db.transaction(['recordings'], 'readwrite');
                const clearStore = clearTransaction.objectStore('recordings');
                await new Promise((resolve, reject) => {
                    const clearRequest = clearStore.clear();
                    clearRequest.onsuccess = () => resolve();
                    clearRequest.onerror = () => reject(clearRequest.error);
                });

                // Adiciona as novas gravações ao IndexedDB
                const transaction = db.transaction(['recordings'], 'readwrite');
                const store = transaction.objectStore('recordings');
                
                for (const recording of data.recordings) {
                    // Converte Base64 de volta para ArrayBuffer
                    const audioBuffer = base64ToArrayBuffer(recording.audioData);
                    const recordingToSave = {
                        ...recording,
                        audioData: audioBuffer
                    };

                    await new Promise((resolve, reject) => {
                        const request = store.add(recordingToSave);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                }

                // Atualiza a variável recordings
                recordings = data.recordings.map(recording => ({
                    ...recording,
                    audioData: base64ToArrayBuffer(recording.audioData)
                }));
                
                renderRecordings();
                
                alert('Backup restaurado com sucesso!');
            } catch (error) {
                console.error('Erro ao importar áudios:', error);
                alert('Erro ao importar os áudios. Por favor, tente novamente.');
            }
        }
    } catch (error) {
        console.error('Erro na importação:', error);
        alert('Erro ao importar o backup. Verifique se o arquivo está correto.');
    }
}

function renderChecklist() {
    const list = document.getElementById('checklistItems');
    const materiaFilter = document.getElementById('materiaFilter').value;
    list.innerHTML = '';
    
    const filteredItems = materiaFilter 
        ? checklistItems.filter(item => item.materia === materiaFilter)
        : checklistItems;
    
    const groupedItems = {};
    filteredItems.forEach(item => {
        if (!groupedItems[item.materia]) {
            groupedItems[item.materia] = [];
        }
        groupedItems[item.materia].push(item);
    });
    
    Object.keys(groupedItems).sort().forEach(materia => {
        const materiaHeader = document.createElement('h3');
        materiaHeader.textContent = materia;
        materiaHeader.style.marginTop = '1rem';
        materiaHeader.style.color = '#2c3e50';
        list.appendChild(materiaHeader);
        
        groupedItems[materia].forEach(item => {
            const li = document.createElement('li');
            li.className = 'checklist-item';
            li.innerHTML = `
                <div class="item-content">
                    <input type="checkbox" ${item.completed ? 'checked' : ''} 
                        onclick="toggleItem(${item.id})">
                    <span class="item-text" style="text-decoration: ${item.completed ? 'line-through' : 'none'}">${item.text}</span>
                </div>
                <button class="delete-btn" onclick="deleteItem(${item.id})">Excluir</button>
            `;
            list.appendChild(li);
        });
    });
}

// Gerenciamento de Gravação de Áudio
let mediaRecorder;
let audioChunks = [];
let recordings = JSON.parse(localStorage.getItem('recordings')) || [];

const startButton = document.getElementById('startRecording');
const stopButton = document.getElementById('stopRecording');
const recordingIndicator = document.querySelector('.recording-indicator');

// Inicialização do IndexedDB
let db;
const dbName = "audioReviewDB";

// Função para carregar áudios do IndexedDB
async function loadRecordings() {
    try {
        const transaction = db.transaction(['recordings'], 'readonly');
        const store = transaction.objectStore('recordings');
        
        recordings = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        renderRecordings();
    } catch (error) {
        console.error('Erro ao carregar gravações:', error);
        recordings = [];
        renderRecordings();
    }
}

// Função para salvar áudio no IndexedDB
function saveRecordingToDB(recording) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['recordings'], 'readwrite');
        const store = transaction.objectStore('recordings');
        const request = store.put(recording);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Função para deletar áudio do IndexedDB
function deleteRecordingFromDB(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['recordings'], 'readwrite');
        const store = transaction.objectStore('recordings');
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function setupAudioRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const materiaAudio = document.getElementById('materiaAudioSelect').value;
            const audioDescription = document.getElementById('audioDescription').value.trim();
            
            if (!materiaAudio || !audioDescription) {
                alert('Por favor, preencha todos os campos!');
                return;
            }

            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            const recording = {
                id: Date.now(),
                description: audioDescription,
                materia: materiaAudio,
                audioData: arrayBuffer
            };
            
            await saveRecordingToDB(recording);
            recordings.push(recording);
            renderRecordings();
            
            audioChunks = [];
            document.getElementById('materiaAudioSelect').value = '';
            document.getElementById('audioDescription').value = '';
            recordingIndicator.classList.remove('active');
        };

        startButton.onclick = () => {
            const materiaAudio = document.getElementById('materiaAudioSelect').value;
            const audioDescription = document.getElementById('audioDescription').value.trim();
            
            if (!materiaAudio) {
                alert('Por favor, selecione uma matéria antes de gravar!');
                return;
            }
            
            if (!audioDescription) {
                alert('Por favor, descreva o conteúdo do áudio!');
                return;
            }
            
            mediaRecorder.start();
            startButton.disabled = true;
            stopButton.disabled = false;
            recordingIndicator.classList.add('active');
        };

        stopButton.onclick = () => {
            mediaRecorder.stop();
            startButton.disabled = false;
            stopButton.disabled = true;
            recordingIndicator.classList.remove('active');
        };

    } catch (err) {
        console.error('Erro ao acessar o microfone:', err);
        alert('Não foi possível acessar o microfone. Verifique as permissões do navegador.');
    }
}

async function deleteRecording(id) {
    const confirmDelete = confirm('Tem certeza que deseja excluir esta gravação?');
    
    if (confirmDelete) {
        try {
            // Primeiro remove do IndexedDB
            await deleteRecordingFromDB(id);
            
            // Depois atualiza a lista em memória
            recordings = recordings.filter(recording => recording.id !== id);
            
            // Salva o estado atual no backup local
            saveBackup();
            
            // Recarrega os áudios do IndexedDB e renderiza
            await loadRecordings();
        } catch (error) {
            console.error('Erro ao deletar gravação:', error);
            alert('Erro ao deletar a gravação. Tente novamente.');
        }
    }
}

function filterRecordings() {
    renderRecordings();
}

let currentPlaybackRate = 1;

function changeGlobalSpeed(select) {
    currentPlaybackRate = parseFloat(select.value);
    // Atualiza todos os players de áudio com a nova velocidade
    document.querySelectorAll('audio').forEach(audio => {
        audio.playbackRate = currentPlaybackRate;
    });
}

function renderRecordings() {
    const list = document.getElementById('recordingsList');
    const materiaFilter = document.getElementById('materiaAudioFilter').value;
    
    // Limpa os URLs antigos antes de limpar o HTML
    const oldAudios = list.querySelectorAll('audio');
    oldAudios.forEach(audio => {
        if (audio.src) {
            URL.revokeObjectURL(audio.src);
        }
    });
    
    list.innerHTML = '';
    
    if (!recordings || recordings.length === 0) {
        return;
    }
    
    const filteredRecordings = materiaFilter 
        ? recordings.filter(recording => recording.materia === materiaFilter)
        : recordings;
    
    const groupedRecordings = {};
    filteredRecordings.forEach(recording => {
        if (!groupedRecordings[recording.materia]) {
            groupedRecordings[recording.materia] = [];
        }
        groupedRecordings[recording.materia].push(recording);
    });
    
    // Array para armazenar todos os elementos de áudio na ordem
    const allAudioElements = [];
    let lastVolume = 1; // Armazena o último volume usado
    
    Object.keys(groupedRecordings).sort().forEach(materia => {
        const materiaHeader = document.createElement('h3');
        materiaHeader.textContent = materia;
        materiaHeader.style.marginTop = '1rem';
        materiaHeader.style.color = '#2c3e50';
        list.appendChild(materiaHeader);
        
        groupedRecordings[materia].forEach(recording => {
            try {
                const li = document.createElement('li');
                const audioBlob = new Blob([recording.audioData], { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                li.innerHTML = `
                    <div class="recording-description">${recording.description}</div>
                    <div class="audio-player">
                        <audio controls src="${audioUrl}"></audio>
                    </div>
                    <button class="delete-btn" onclick="deleteRecording(${recording.id})">Excluir</button>
                `;
                
                list.appendChild(li);
                
                const audio = li.querySelector('audio');
                audio.playbackRate = currentPlaybackRate;
                audio.volume = lastVolume; // Define o volume inicial
                
                // Adiciona o elemento de áudio ao array
                allAudioElements.push(audio);
                
                // Monitora mudanças no volume
                audio.addEventListener('volumechange', () => {
                    lastVolume = audio.volume; // Atualiza o último volume usado
                    // Aplica o mesmo volume a todos os áudios
                    allAudioElements.forEach(otherAudio => {
                        if (otherAudio !== audio) {
                            otherAudio.volume = lastVolume;
                        }
                    });
                });
                
                // Configura a reprodução automática do próximo áudio
                audio.addEventListener('ended', () => {
                    const currentIndex = allAudioElements.indexOf(audio);
                    const nextAudio = allAudioElements[currentIndex + 1];
                    if (nextAudio) {
                        nextAudio.volume = lastVolume; // Define o volume antes de iniciar
                        nextAudio.play();
                    }
                });
                
                // Atualiza a velocidade quando o áudio for carregado
                audio.addEventListener('loadedmetadata', () => {
                    audio.playbackRate = currentPlaybackRate;
                    audio.volume = lastVolume; // Garante o volume correto ao carregar
                });
                
                // Limpa a URL do objeto quando o elemento for removido
                li.addEventListener('remove', () => {
                    URL.revokeObjectURL(audioUrl);
                });
            } catch (error) {
                console.error('Erro ao renderizar áudio:', error);
            }
        });
    });
    
    // Adiciona evento para quando um áudio começar a tocar, pausar os outros
    allAudioElements.forEach(audio => {
        audio.addEventListener('play', () => {
            allAudioElements.forEach(otherAudio => {
                if (otherAudio !== audio && !otherAudio.ended) {
                    otherAudio.pause();
                    otherAudio.currentTime = 0;
                    otherAudio.volume = lastVolume; // Mantém o volume consistente
                }
            });
        });
    });
}

// Carrega backup ao iniciar
function loadBackup() {
    const backupData = localStorage.getItem('backup_data');
    if (backupData) {
        try {
            const data = JSON.parse(backupData);
            if (data.checklistItems) checklistItems = data.checklistItems;
            if (data.recordings) recordings = data.recordings;
        } catch (error) {
            console.error('Erro ao carregar backup:', error);
        }
    }
}

// Sistema de Lembretes de Backup
function checkBackupReminder() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Verifica se é meio-dia (12:00) ou 17:00
    if ((hours === 12 && minutes === 0) || (hours === 17 && minutes === 0)) {
        alert('Lembrete: É hora de fazer o backup dos seus dados!');
        // Cria uma notificação do sistema se permitido
        if (Notification.permission === "granted") {
            new Notification("Lembrete de Backup", {
                body: "É hora de fazer o backup dos seus dados!",
                icon: "/favicon.ico"
            });
        }
    }
}

// Solicita permissão para notificações
function requestNotificationPermission() {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

// Inicializa o sistema de lembretes
function initializeBackupReminders() {
    requestNotificationPermission();
    // Verifica a cada minuto
    setInterval(checkBackupReminder, 60000);
    // Verifica imediatamente
    checkBackupReminder();
}

// Atualiza a inicialização
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                db = request.result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                db = event.target.result;
                if (!db.objectStoreNames.contains('recordings')) {
                    const store = db.createObjectStore('recordings', { keyPath: 'id' });
                    store.createIndex('materia', 'materia', { unique: false });
                }
            };
        });
        
        await loadRecordings();
        loadBackup();
        renderChecklist();
        setupAudioRecording();
        initializeBackupReminders();
    } catch (error) {
        console.error('Erro na inicialização:', error);
        alert('Erro ao carregar os dados. Por favor, recarregue a página.');
    }
}); 