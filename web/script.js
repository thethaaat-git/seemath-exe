window.addEventListener('load', () => {
    let appData = { "urs": [] };
    let currentEqIndex = -1;
    let editingData = null;

    // Безопасная работа с localStorage (чтобы не падало в pywebview)
    let savedTheme = 'light';
    try { savedTheme = localStorage.getItem('theme'); } catch (e) { console.warn("localStorage недоступен"); }

    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    function applyTheme(isDark) {
        if (isDark) {
            document.body.classList.add('dark-theme');
            if(themeIcon) themeIcon.src = '/assets/moon.png';
            try { localStorage.setItem('theme', 'dark'); } catch(e){}
        } else {
            document.body.classList.remove('dark-theme');
            if(themeIcon) themeIcon.src = '/assets/sun.png';
            try { localStorage.setItem('theme', 'light'); } catch(e){}
        }
    }

    if (savedTheme === 'dark') applyTheme(true);
    else applyTheme(false);

    if (themeToggleBtn) {
        themeToggleBtn.onclick = () => applyTheme(!document.body.classList.contains('dark-theme'));
    }

    const sidebar = document.getElementById('sidebar');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const openSidebarBtn = document.getElementById('open-sidebar-btn');

    if (closeSidebarBtn) {
        closeSidebarBtn.onclick = () => {
            sidebar.classList.add('hidden-panel');
            document.body.classList.add('sidebar-closed'); 
            openSidebarBtn.classList.remove('hidden');
        };
    }

    if (openSidebarBtn) {
        openSidebarBtn.onclick = () => {
            sidebar.classList.remove('hidden-panel');
            document.body.classList.remove('sidebar-closed'); 
            openSidebarBtn.classList.add('hidden');
        };
    }

    async function init() {
        try {
            const response = await fetch('/lib.json');
            if (response.ok) appData = await response.json();
        } catch (e) { console.log("Ошибка загрузки lib.json", e); }
        renderSidebar();
    }

    function renderSidebar() {
        const list = document.getElementById('equation-list');
        if (!list) return;
        list.innerHTML = '';
        if (!appData.urs) appData.urs = [];
        appData.urs.forEach((eq, index) => {
            const li = document.createElement('li');
            li.textContent = eq.uname;
            li.onclick = () => selectEquation(index, li);
            list.appendChild(li);
        });
    }

    function selectEquation(index, el) {
        document.querySelectorAll('#equation-list li').forEach(l => l.classList.remove('active'));
        el.classList.add('active');
        currentEqIndex = index;
        renderEquation(appData.urs[index]);
    }

    const circleMap = { "1":"①", "2":"②", "3":"③", "4":"④", "5":"⑤", "6":"⑥", "7":"⑦", "8":"⑧", "9":"⑨", "10":"⑩", "11":"⑪", "12":"⑫", "13":"⑬", "14":"⑭", "15":"⑮" };

    function renderEquation(eq) {
        const area = document.getElementById('content-area');
        area.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <h1 style="color: var(--text-main); margin: 0;">${eq.uname}</h1>
                <button class="primary-btn" onclick="openEditor(${currentEqIndex})">✎ Редактировать</button>
            </div>
            <div id="steps-render-area" style="width: 100%; margin-top: 20px;"></div>
        `;
        
        const container = document.getElementById('steps-render-area');
        
        const drawSteps = (operations, parentContainer, startNum) => {
            let currentNum = startNum;
            
            Object.keys(operations).forEach((key) => {
                const op = operations[key];
                
                if (op.type === 'path') {
                    const pathBlock = document.createElement('div');
                    pathBlock.className = 'path-choice-block';
                    
                    let tabsHtml = `<div class="path-tabs">`;
                    let contentsHtml = `<div class="path-contents">`;
                    let maxStepAfterPath = currentNum;

                    op.paths.forEach((path, pIdx) => {
                        tabsHtml += `<button class="path-btn ${pIdx === 0 ? 'active' : ''}" onclick="switchPath(this, ${pIdx})">${path.name}</button>`;
                        
                        const pathContentDiv = document.createElement('div');
                        pathContentDiv.className = 'path-content';
                        pathContentDiv.style.display = pIdx === 0 ? 'block' : 'none';
                        pathContentDiv.dataset.pathIdx = pIdx;
                        
                        let endNum = drawSteps(path.operations, pathContentDiv, currentNum);
                        if (endNum > maxStepAfterPath) maxStepAfterPath = endNum;
                        
                        contentsHtml += pathContentDiv.outerHTML;
                    });

                    currentNum = maxStepAfterPath;
                    tabsHtml += `</div>`;
                    contentsHtml += `</div>`;
                    pathBlock.innerHTML = tabsHtml + contentsHtml;
                    parentContainer.appendChild(pathBlock);

                } else {
                    const hasContent = op.name || Object.keys(op).some(k => k.startsWith('str') && op[k].trim() !== '');
                    if (!hasContent) return;

                    const block = document.createElement('div');
                    block.className = 'operation-block';

                    const circle = circleMap[currentNum] || currentNum;
                    currentNum++;

                    let html = `<div class="op-title"><span class="op-circle">${circle}</span> ${op.name || ''}</div>`;
                    
                    const subKeys = Object.keys(op).filter(k => k !== 'name' && k !== 'type').sort((a, b) => parseInt(a.replace(/\D/g, '')) - parseInt(b.replace(/\D/g, '')));
                    subKeys.forEach(subKey => {
                        if (op[subKey].trim() === '') return;
                        if (subKey.startsWith('str')) {
                            html += `<div class="math-line">${formatMath(op[subKey])}</div>`;
                        } else if (subKey.startsWith('rl')) {
                            html += `<div class="math-rule">${formatMath(op[subKey])}</div>`;
                        }
                    });
                    block.innerHTML = html;
                    parentContainer.appendChild(block);
                }
            });
            return currentNum;
        };

        drawSteps(eq.operations, container, 1);
    }

    window.switchPath = (btn, pIdx) => {
        const tabsContainer = btn.parentElement;
        const contentsContainer = tabsContainer.nextElementSibling;
        tabsContainer.querySelectorAll('.path-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        contentsContainer.querySelectorAll('.path-content').forEach(c => {
            c.style.display = c.dataset.pathIdx == pIdx ? 'block' : 'none';
        });
    };

    function formatMath(str) {
        if (!str) return "";
        let latex = str;

        latex = latex.replace(/(\d+)_([a-zA-Z0-9а-яА-Я]+)\/([a-zA-Z0-9а-яА-Я]+)/g, '$1\\dfrac{$2}{$3}');
        latex = latex.replace(/\(([^)]+)\)\s*\/\s*\(([^)]+)\)/g, '\\dfrac{$1}{$2}');
        latex = latex.replace(/([a-zA-Z0-9а-яА-Я_.]+)\s*\/\s*([a-zA-Z0-9а-яА-Я_.]+)/g, '\\dfrac{$1}{$2}');
        latex = latex.replace(/[√٧]\(([^)]+)\)/g, '\\sqrt{$1}');
        latex = latex.replace(/\(([^)]+)\)\s*\^\s*([a-zA-Z0-9а-яА-Я]+)/g, '\\left($1\\right)^{$2}');
        latex = latex.replace(/([a-zA-Z0-9а-яА-Я]+)\s*\^\s*([a-zA-Z0-9а-яА-Я]+)/g, '{$1}^{$2}');
        latex = latex.replace(/\*/g, '\\cdot ');
        
        latex = latex.replace(/([а-яА-ЯёЁ])\s*:/g, '$1__COLON__');
        latex = latex.replace(/:/g, '\\div ');
        latex = latex.replace(/__COLON__/g, ':');

        latex = latex.replace(/([а-яА-ЯёЁ][а-яА-ЯёЁ\s]*[а-яА-ЯёЁ])/g, '\\text{$1}');
        latex = latex.replace(/([а-яА-ЯёЁ])/g, '\\text{$1}'); 
        latex = latex.replace(/ /g, '\\ ');

        try {
            if (typeof katex === 'undefined') {
                console.warn("KaTeX не загружен!");
                return str;
            }
            return katex.renderToString(latex, { throwOnError: false, displayMode: false, strict: false });
        } catch (e) {
            console.error("Ошибка KaTeX:", e);
            return str;
        }
    }

    // --- ЛОГИКА РЕДАКТОРА ---
    document.getElementById('add-eq-btn').onclick = () => openEditor(-1);

    window.openEditor = function(index) {
        if (index === -1) {
            editingData = { uname: "", operations: [] };
        } else {
            const rawEq = JSON.parse(JSON.stringify(appData.urs[index]));
            editingData = { uname: rawEq.uname, operations: parseOpsToArray(rawEq.operations) };
        }
        document.getElementById('edit-uname').value = editingData.uname;
        renderEditorSteps();
        document.getElementById('editor-modal').classList.remove('hidden');
    }

    function parseOpsToArray(opsObj) {
        return Object.keys(opsObj).map(k => {
            const op = opsObj[k];
            if (op.type === 'path') {
                return { type: 'path', paths: op.paths.map(p => ({ name: p.name, operations: parseOpsToArray(p.operations) })) };
            } else {
                const lines = [];
                Object.keys(op).forEach(subKey => {
                    if (subKey !== 'name' && subKey !== 'type') lines.push({ type: subKey.startsWith('str') ? 'str' : 'rl', val: op[subKey] });
                });
                lines.sort((a, b) => a.type.localeCompare(b.type));
                return { type: 'step', name: op.name, lines: lines };
            }
        });
    }

    function renderEditorSteps() {
        const container = document.getElementById('steps-container');
        container.innerHTML = '';
        
        const renderOps = (opsArray, parentContainer) => {
            opsArray.forEach((step, stepIdx) => {
                if (step.type === 'path') {
                    let pathsHtml = '';
                    step.paths.forEach((path, pIdx) => {
                        let innerStepsHtml = '';
                        path.operations.forEach((innerStep, iStepIdx) => {
                            if (innerStep.type === 'step') innerStepsHtml += renderStepEditor(innerStep, stepIdx, pIdx, iStepIdx);
                        });
                        pathsHtml += `
                            <div class="variant-edit-block">
                                <div class="variant-header">
                                    <input type="text" value="${path.name}" oninput="updatePathName(${stepIdx}, ${pIdx}, this.value)" placeholder="Название (Путь 1)" style="margin-bottom:0; width: 60%;">
                                    <button class="delete-step-btn" onclick="removePath(${stepIdx}, ${pIdx})">Удалить путь</button>
                                </div>
                                ${innerStepsHtml}
                                <button class="secondary-btn" style="font-size: 0.8rem; margin-top: 10px;" onclick="addStepToPath(${stepIdx}, ${pIdx})">+ Добавить шаг в этот путь</button>
                            </div>
                        `;
                    });
                    parentContainer.innerHTML += `
                        <div class="branch-edit-block" style="margin-top: 15px;">
                            <div class="step-header" style="color: var(--accent);">
                                <span>🔀 ВЫБОР ПУТИ</span>
                                <button class="delete-step-btn" onclick="removeTopStep(${stepIdx})">Удалить выбор</button>
                            </div>
                            ${pathsHtml}
                            <button class="primary-btn" style="font-size: 0.8rem; margin-top: 10px;" onclick="addPath(${stepIdx})">+ Добавить еще один путь</button>
                        </div>
                    `;
                } else {
                    parentContainer.innerHTML += renderStepEditor(step, stepIdx, null, null);
                }
            });
        };
        renderOps(editingData.operations, container);
    }

    function renderStepEditor(step, stepIdx, pathIdx, iStepIdx) {
        const onUpdateName = pathIdx !== null ? `updateInnerStepName(${stepIdx}, ${pathIdx}, ${iStepIdx}, this.value)` : `updateStepName(${stepIdx}, this.value)`;
        let linesHtml = step.lines.map((line, lineIdx) => renderLineEditor(line, stepIdx, pathIdx, iStepIdx, lineIdx)).join('');

        return `
            <div class="step-edit-block" style="margin-top: 10px;">
                <div class="step-header">
                    <span>${pathIdx !== null ? 'Шаг внутри пути' : 'Обычный шаг'}</span>
                    <button class="delete-step-btn" onclick="removeLineOrStep(${stepIdx}, ${pathIdx}, ${iStepIdx})">✖ Удалить шаг</button>
                </div>
                <input type="text" value="${step.name}" oninput="${onUpdateName}" placeholder="Название шага">
                ${linesHtml}
                <button class="secondary-btn" style="font-size: 0.8rem;" onclick="addLineToStep(${stepIdx}, ${pathIdx}, ${iStepIdx})">+ Добавить строку</button>
            </div>
        `;
    }

    function renderLineEditor(line, stepIdx, pathIdx, iStepIdx, lineIdx) {
        const inputId = `input-${stepIdx}-${pathIdx}-${iStepIdx}-${lineIdx}`;
        const onUpdate = pathIdx !== null ? `updateInnerLineVal(${stepIdx}, ${pathIdx}, ${iStepIdx}, ${lineIdx}, this.value)` : `updateLineVal(${stepIdx}, ${lineIdx}, this.value)`;
        const onTypeChange = pathIdx !== null ? `updateInnerLineType(${stepIdx}, ${pathIdx}, ${iStepIdx}, ${lineIdx}, this.value)` : `updateLineType(${stepIdx}, ${lineIdx}, this.value)`;
            
        const toolbar = `
            <div class="math-toolbar">
                <button onclick="insertMath('${inputId}', '/')">a/b</button>
                <button onclick="insertMath('${inputId}', '1_1/2')">1_дробь</button>
                <button onclick="insertMath('${inputId}', '√()')">√</button>
                <button onclick="insertMath('${inputId}', '^2')">x²</button>
                <button onclick="insertMath('${inputId}', '+')">+</button>
                <button onclick="insertMath('${inputId}', '-')">-</button>
                <button onclick="insertMath('${inputId}', '*')">×</button>
                <button onclick="insertMath('${inputId}', ':')">÷</button>
                <button onclick="insertMath('${inputId}', '=')">=</button>
                <button onclick="insertMath('${inputId}', 'x')">x</button>
                <button onclick="insertMath('${inputId}', 'y')">y</button>
            </div>
        `;

        return `
            <div class="line-inputs">
                <div style="display:flex; justify-content: space-between; margin-bottom: 5px;">
                    <select onchange="${onTypeChange}">
                        <option value="str" ${line.type === 'str' ? 'selected' : ''}>Действие (обычное)</option>
                        <option value="rl" ${line.type === 'rl' ? 'selected' : ''}>Правило, свойство, формула (курсив)</option>
                    </select>
                    <button onclick="removeLine(${stepIdx}, ${pathIdx}, ${iStepIdx}, ${lineIdx})" style="padding: 0 10px; margin-left: auto;">✖ Строка</button>
                </div>
                ${toolbar}
                <input type="text" id="${inputId}" value="${line.val}" oninput="${onUpdate}" placeholder="Введи формулу или текст...">
            </div>
        `;
    }

    window.updateStepName = (idx, val) => editingData.operations[idx].name = val;
    window.updatePathName = (stepIdx, pIdx, val) => editingData.operations[stepIdx].paths[pIdx].name = val;
    window.updateInnerStepName = (stepIdx, pIdx, iStepIdx, val) => editingData.operations[stepIdx].paths[pIdx].operations[iStepIdx].name = val;
    window.updateLineVal = (idx, lineIdx, val) => editingData.operations[idx].lines[lineIdx].val = val;
    window.updateInnerLineVal = (stepIdx, pIdx, iStepIdx, lineIdx, val) => editingData.operations[stepIdx].paths[pIdx].operations[iStepIdx].lines[lineIdx].val = val;
    window.updateLineType = (idx, lineIdx, val) => editingData.operations[idx].lines[lineIdx].type = val;
    window.updateInnerLineType = (stepIdx, pIdx, iStepIdx, lineIdx, val) => editingData.operations[stepIdx].paths[pIdx].operations[iStepIdx].lines[lineIdx].type = val;

    window.insertMath = (inputId, text) => {
        const input = document.getElementById(inputId);
        if (!input) return;
        const startPos = input.selectionStart;
        const endPos = input.selectionEnd;
        input.value = input.value.substring(0, startPos) + text + input.value.substring(endPos);
        input.focus();
        input.selectionStart = input.selectionEnd = startPos + text.length;
        input.dispatchEvent(new Event('input'));
    };

    window.addLineToStep = (stepIdx, pIdx, iStepIdx) => {
        if (pIdx !== null) editingData.operations[stepIdx].paths[pIdx].operations[iStepIdx].lines.push({ type: 'str', val: '' });
        else editingData.operations[stepIdx].lines.push({ type: 'str', val: '' });
        renderEditorSteps();
    };

    window.removeLine = (stepIdx, pIdx, iStepIdx, lineIdx) => {
        if (pIdx !== null) editingData.operations[stepIdx].paths[pIdx].operations[iStepIdx].lines.splice(lineIdx, 1);
        else editingData.operations[stepIdx].lines.splice(lineIdx, 1);
        renderEditorSteps();
    };

    window.removeLineOrStep = (stepIdx, pIdx, iStepIdx) => {
        if (pIdx !== null) editingData.operations[stepIdx].paths[pIdx].operations.splice(iStepIdx, 1);
        else editingData.operations.splice(stepIdx, 1);
        renderEditorSteps();
    };

    window.removeTopStep = (stepIdx) => { editingData.operations.splice(stepIdx, 1); renderEditorSteps(); };
    window.addPath = (stepIdx) => {
        editingData.operations[stepIdx].paths.push({ name: `Путь ${editingData.operations[stepIdx].paths.length + 1}`, operations: [{ type: 'step', name: '', lines: [{ type: 'str', val: '' }] }] });
        renderEditorSteps();
    };
    window.removePath = (stepIdx, pIdx) => { editingData.operations[stepIdx].paths.splice(pIdx, 1); renderEditorSteps(); };
    window.addStepToPath = (stepIdx, pIdx) => {
        editingData.operations[stepIdx].paths[pIdx].operations.push({ type: 'step', name: '', lines: [{ type: 'str', val: '' }] });
        renderEditorSteps();
    };

    document.getElementById('add-step-btn').onclick = () => {
        editingData.operations.push({ type: 'step', name: '', lines: [{ type: 'str', val: '' }] });
        renderEditorSteps();
    };

    document.getElementById('add-branch-btn').onclick = () => {
        editingData.operations.push({ 
            type: 'path', 
            paths: [
                { name: 'Путь 1', operations: [{ type: 'step', name: '', lines: [{ type: 'str', val: '' }] }] },
                { name: 'Путь 2', operations: [{ type: 'step', name: '', lines: [{ type: 'str', val: '' }] }] }
            ] 
        });
        renderEditorSteps();
    };

    document.getElementById('save-btn').onclick = async () => {
        editingData.uname = document.getElementById('edit-uname').value || "Без названия";
        const buildOpsObject = (opsArray) => {
            const opsObject = {};
            opsArray.forEach((step, index) => {
                if (step.type === 'path') {
                    const pathsArr = step.paths.map(p => ({ name: p.name, operations: buildOpsObject(p.operations) }));
                    opsObject[`path_${index + 1}`] = { type: 'path', paths: pathsArr };
                } else {
                    const stepObj = { name: step.name };
                    let s = 1, r = 1;
                    step.lines.forEach(l => { stepObj[`${l.type}${l.type==='str'?s++:r++}`] = l.val; });
                    opsObject[`${index + 1}`] = stepObj;
                }
            });
            return opsObject;
        };

        const finalEq = { uname: editingData.uname, operations: buildOpsObject(editingData.operations) };
        if (currentEqIndex === -1) appData.urs.push(finalEq);
        else appData.urs[currentEqIndex] = finalEq;

        try {
            const response = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(appData) });
            if (response.ok) {
                document.getElementById('editor-modal').classList.add('hidden');
                renderSidebar();
                if (currentEqIndex === -1) currentEqIndex = appData.urs.length - 1;
                selectEquation(currentEqIndex, document.querySelectorAll('#equation-list li')[currentEqIndex]);
            }
        } catch (e) { alert("Ошибка сохранения!"); }
    };

    document.getElementById('cancel-btn').onclick = () => document.getElementById('editor-modal').classList.add('hidden');
    
    // Запуск
    init();
});