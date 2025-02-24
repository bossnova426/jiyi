// 添加在文件开头的全局变量区域
let currentNumber = 1;
let startTime = null;
let gridSize = 5;
let memoryMode = false;
let numbersHidden = false;
let numberPositions = {};
let leaderboard = [];
let gistId = '6f89dfc61535d0705c745a211aff5cbd'; // 添加 Gist ID
let lastSyncTime = 0;        // 添加同步时间戳
// 添加一个全局变量来存储完成时的时间
let completionTime = null;

// 修改 loadLeaderboard 函数
async function loadLeaderboard() {
    try {
        // 先加载本地数据
        const saved = localStorage.getItem('leaderboard');
        leaderboard = saved ? JSON.parse(saved) : [];
        
        // 从 Gist 同步数据
        const response = await fetch(`https://api.github.com/gists/${gistId}`);
        if (response.ok) {
            const data = await response.json();
            const content = JSON.parse(data.files['leaderboard.json'].content);
            // 合并远程和本地数据
            leaderboard = mergeLeaderboards(leaderboard, content);
            localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
            lastSyncTime = Date.now();
        }
    } catch (error) {
        console.log('使用本地数据');
    }
}

// 修改 saveLeaderboard 函数
async function saveLeaderboard() {
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
    
    try {
        if (Date.now() - lastSyncTime > 10000) {
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    files: {
                        'leaderboard.json': {
                            content: JSON.stringify(leaderboard)
                        }
                    }
                })
            });
            
            if (response.ok) {
                lastSyncTime = Date.now();
            }
        }
    } catch (error) {
        console.log('本地保存成功，在线同步失败');
    }
}

// 添加数据合并函数
function mergeLeaderboards(local, remote) {
    const merged = [...local];
    for (const score of remote) {
        const exists = merged.some(localScore => 
            localScore.name === score.name &&
            localScore.time === score.time &&
            localScore.mode === score.mode &&
            localScore.size === score.size &&
            localScore.memoryTime === score.memoryTime
        );
        if (!exists) {
            merged.push(score);
        }
    }
    return merged;
}
// 初始化网格
function initializeGrid(size = gridSize) {
    gridSize = size;
    currentNumber = 1;
    startTime = null;
    // 删除这行，不要重置记忆模式状态
    // memoryMode = false;
    numbersHidden = false;
    document.getElementById('memory-mode-btn').disabled = false;
    
    const grid = document.getElementById('grid');
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    grid.innerHTML = '';
    
    // 生成随机数字
    const numbers = Array.from({length: size * size}, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    
    // 创建按钮
    numbers.forEach((number, index) => {
        const button = document.createElement('button');
        button.textContent = number;
        button.onclick = () => handleClick(number);
        grid.appendChild(button);
        numberPositions[number] = index;
    });
    
    updateStatus("当前数字: 1");
}
// 处理点击事件
// 修改 handleClick 函数中完成时的部分
function handleClick(number) {
    if (!memoryMode || (memoryMode && numbersHidden)) {
        if (number === currentNumber) {
            if (currentNumber === 1) {
                startTime = Date.now();
                // 记忆模式下，需要从隐藏数字时开始计时
                if (memoryMode) {
                    const memoryTime = parseInt(document.getElementById('memory-time').value);
                    startTime = startTime - (memoryTime * 1000); // 减去记忆时间
                }
            }
            
            const button = document.getElementById('grid').children[numberPositions[number]];
            button.classList.add('correct');
            button.textContent = number;
            
            if (currentNumber === gridSize * gridSize) {
                const elapsed = (Date.now() - startTime) / 1000;
                completionTime = elapsed; // 保存完成时的时间
                const modeText = memoryMode ? "记忆模式" : "普通模式";
                updateStatus(`${modeText}完成！用时: ${elapsed.toFixed(2)}秒`);
                checkLeaderboard(elapsed, memoryMode);
            } else {
                currentNumber++;
                updateStatus(`当前数字: ${currentNumber}`);
            }
        }
    }
}
// 修改检查记录函数签名
function checkLeaderboard(elapsed, isMemoryMode = null) {
    const currentSize = `${gridSize}x${gridSize}`;
    const currentMode = (isMemoryMode !== null ? isMemoryMode : memoryMode) ? "记忆模式" : "普通模式";
    const memoryTime = currentMode === "记忆模式" ? document.getElementById('memory-time').value : "0";
    
    loadLeaderboard();
    
    const sameCategory = leaderboard.filter(score => 
        score.mode === currentMode && 
        score.size === currentSize &&
        (currentMode === "普通模式" ? score.memoryTime === "0" : score.memoryTime === memoryTime)
    );
    
    if (sameCategory.length < 10 || !sameCategory.length || elapsed < Math.max(...sameCategory.map(s => s.time))) {
        showCongratsDialog(elapsed, currentMode, currentSize, sameCategory.length + 1);
    }
}
// 开始记忆模式
function startMemoryMode() {
    memoryMode = true;
    initializeGrid();
    document.getElementById('memory-mode-btn').disabled = true;
    
    const memoryTime = parseInt(document.getElementById('memory-time').value);
    let remainingTime = memoryTime;
    
    function updateCountdown() {
        if (remainingTime > 0) {
            updateStatus(`记忆倒计时: ${remainingTime}秒`);
            remainingTime--;
            setTimeout(updateCountdown, 1000);
        } else {
            hideNumbers();
            updateStatus("开始按顺序点击方格！");
        }
    }
    
    updateCountdown();
}
// 隐藏数字
function hideNumbers() {
    numbersHidden = true;
    const buttons = document.getElementById('grid').children;
    for (let button of buttons) {
        button.textContent = '';
    }
    document.getElementById('memory-mode-btn').disabled = false;
}
// 更新状态显示
function updateStatus(text) {
    document.getElementById('status').textContent = text;
}
// 检查是否创造新记录
function checkLeaderboard(elapsed) {
    const currentSize = `${gridSize}x${gridSize}`;
    const currentMode = memoryMode ? "记忆模式" : "普通模式";
    const memoryTime = memoryMode ? document.getElementById('memory-time').value : "0";
    
    loadLeaderboard();
    
    const sameCategory = leaderboard.filter(score => 
        score.mode === currentMode && 
        score.size === currentSize &&
        (currentMode === "普通模式" ? score.memoryTime === "0" : score.memoryTime === memoryTime)
    );
    
    // 计算实际排名
    let rank = 1;
    for (const score of sameCategory) {
        if (score.time < elapsed) {
            rank++;
        }
    }
    
    // 如果是前10名或者还没有10条记录，显示祝贺对话框
    if (rank <= 10 || sameCategory.length < 10) {
        showCongratsDialog(elapsed, currentMode, currentSize, rank);
    }
}
// 提交分数
function submitScore() {
    const name = document.getElementById('player-name').value;
    if (!name) return;
    
    // 使用对话框中显示的完成时间，而不是重新计算
    const message = document.getElementById('congrats-message').innerHTML;
    const timeMatch = message.match(/完成时间：(\d+\.\d+)秒/);
    const elapsed = timeMatch ? parseFloat(timeMatch[1]) : 0;
    
    const currentMode = memoryMode ? "记忆模式" : "普通模式";
    const score = {
        name,
        time: elapsed,  // 使用对话框中的时间
        mode: currentMode,
        size: `${gridSize}x${gridSize}`,
        memoryTime: currentMode === "记忆模式" ? document.getElementById('memory-time').value : "0"
    };
    
    leaderboard.push(score);
    saveLeaderboard();
    showLeaderboard(score.mode);
    
    document.getElementById('congrats-dialog').close();
    document.getElementById('leaderboard-dialog').showModal();
}
// 显示祝贺对话框
function showCongratsDialog(elapsed, mode, size, rank) {
    const dialog = document.getElementById('congrats-dialog');
    document.getElementById('congrats-message').innerHTML = 
        `恭喜！你在${mode} ${size}中<br>` +
        `创造了第${rank}名的好成绩！<br>` +
        `完成时间：${elapsed.toFixed(2)}秒`;
    dialog.showModal();
}
// 提交分数
// 删除重复的 submitScore 函数，只保留这一个
function submitScore() {
    const name = document.getElementById('player-name').value;
    if (!name) return;
    const currentMode = memoryMode ? "记忆模式" : "普通模式";
    const score = {
        name,
        time: completionTime,  // 使用完成时保存的时间，而不是从对话框获取
        mode: currentMode,
        size: `${gridSize}x${gridSize}`,
        memoryTime: currentMode === "记忆模式" ? document.getElementById('memory-time').value : "0"
    };
    
    leaderboard.push(score);
    saveLeaderboard();
    showLeaderboard(score.mode);
    
    document.getElementById('congrats-dialog').close();
    document.getElementById('leaderboard-dialog').showModal();
}
// 加载排行榜
function loadLeaderboard() {
    const saved = localStorage.getItem('leaderboard');
    leaderboard = saved ? JSON.parse(saved) : [];
}

// 保存排行榜
function saveLeaderboard() {
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
}

// 显示排行榜
function showLeaderboard(mode) {
    const content = document.getElementById('leaderboard-content');
    content.innerHTML = '';
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === mode);
    });
    
    for (let size of ['3x3', '4x4', '5x5', '6x6']) {
        const sizeScores = leaderboard.filter(score => 
            score.mode === mode && score.size === size
        );
        
        if (sizeScores.length > 0) {
            const sizeTitle = document.createElement('h3');
            sizeTitle.textContent = `${size}网格:`;
            content.appendChild(sizeTitle);
            
            if (mode === "记忆模式") {
                const memoryTimes = [...new Set(sizeScores.map(s => s.memoryTime))];
                memoryTimes.sort((a, b) => parseInt(a) - parseInt(b));
                
                for (let memTime of memoryTimes) {
                    const timeScores = sizeScores
                        .filter(s => s.memoryTime === memTime)
                        .sort((a, b) => a.time - b.time)
                        .slice(0, 10);
                    
                    if (timeScores.length > 0) {
                        const difficulty = memTime > 10 ? "简单" : memTime > 5 ? "中等" : "困难";
                        const timeTitle = document.createElement('h4');
                        timeTitle.textContent = `记忆时间 ${memTime}秒 (${difficulty}):`;
                        content.appendChild(timeTitle);
                        
                        displayScores(timeScores, content);
                    }
                }
            } else {
                const scores = sizeScores
                    .sort((a, b) => a.time - b.time)
                    .slice(0, 10);
                displayScores(scores, content);
            }
        }
    }
    
    document.getElementById('leaderboard-dialog').showModal();
}

// 显示分数列表
function displayScores(scores, container) {
    const list = document.createElement('div');
    scores.forEach((score, index) => {
        const item = document.createElement('div');
        item.textContent = `${index + 1}. ${score.name}: ${score.time.toFixed(2)}秒`;
        list.appendChild(item);
    });
    container.appendChild(list);
}

// 初始化页面
window.onload = () => {
    initializeGrid();
    loadLeaderboard();
};