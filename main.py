import http.server
import socketserver
import json
import os
import sys
import threading
import time
import shutil
import webview

# --- 1. НАСТРОЙКА ПУТЕЙ ДЛЯ РАБОТЫ В EXE ---
APP_NAME = "SeeMath"

# Проверяем, запущены ли мы из собранного .exe файла
if getattr(sys, 'frozen', False):
    # Папка, куда PyInstaller распаковал файлы (внутренняя папка программы)
    BASE_DIR = sys._MEIPASS
else:
    # Папка, где лежит сам скрипт (если запускаем из исходников)
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Определяем системную папку для сохранения lib.json (AppData на Windows)
if sys.platform == "win32":
    DATA_DIR = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), APP_NAME)
else:
    DATA_DIR = os.path.join(os.path.expanduser('~'), '.local', 'share', APP_NAME)

# Создаем папку данных, если ее нет
os.makedirs(DATA_DIR, exist_ok=True)

# Путь к файлу, куда будут сохраняться уравнения
FILE_PATH = os.path.join(DATA_DIR, 'lib.json')
# Путь к стандартному файлу lib.json внутри программы
DEFAULT_FILE_PATH = os.path.join(BASE_DIR, 'lib.json')

# Если пользователь запускает программу впервые, копируем стартовый lib.json
if not os.path.exists(FILE_PATH) and os.path.exists(DEFAULT_FILE_PATH):
    shutil.copy(DEFAULT_FILE_PATH, FILE_PATH)

# ВАЖНО: Меняем рабочую директорию на внутреннюю папку программы,
# чтобы сервер мог найти папки web, assets и fons
os.chdir(BASE_DIR)

# --- 2. ЛОГИКА СЕРВЕРА ---
PORT_CANDIDATES = [1234, 4321, 1111, 0, 8888]
active_port = None
httpd = None

class MathHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(302)
            self.send_header('Location', '/web/')
            self.end_headers()
            return
        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data)
                # Сохраняем именно в системную папку (FILE_PATH), а не рядом с exe
                with open(FILE_PATH, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=4)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status":"ok"}')
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode())
        else:
            self.send_response(404)
            self.end_headers()

def start_server():
    global active_port, httpd
    for port in PORT_CANDIDATES:
        try:
            socketserver.TCPServer.allow_reuse_address = True
            httpd = socketserver.TCPServer(("", port), MathHandler)
            active_port = httpd.server_address[1]
            print(f"Сервер запущен! URL: http://localhost:{active_port}/web/")
            print(f"Данные сохраняются в: {FILE_PATH}")
            httpd.serve_forever()
            break
        except OSError:
            continue
            
    if not active_port:
        print("ОШИБКА: Все порты заняты.")
        sys.exit(1)

# Запускаем сервер в фоне
server_thread = threading.Thread(target=start_server, daemon=True)
server_thread.start()
time.sleep(1)

# --- 3. ЗАПУСК ОКНА ПРИЛОЖЕНИЯ ---
if __name__ == '__main__':
    # Ищем иконку
    icon_path = os.path.join(BASE_DIR, 'assets', 'icon.ico') # Для exe лучше .ico
    if not os.path.exists(icon_path):
        icon_path = os.path.join(BASE_DIR, 'assets', 'icon.png')

    window = webview.create_window(
        title='SeeMath',
        url=f'http://localhost:{active_port}/web/',
        width=1280,
        height=850,
        background_color='#000000'
    )
    
    try:
        webview.start(icon=icon_path if os.path.exists(icon_path) else None)
    except Exception as e:
        print("Ошибка запуска приложения:", e)
    
    if httpd:
        httpd.shutdown()