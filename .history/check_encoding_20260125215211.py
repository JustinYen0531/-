import os

def check_encoding(file_path):
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
        
        # Try to decode as utf-8
        try:
            content.decode('utf-8')
            print(f"File {file_path} is valid UTF-8")
        except UnicodeDecodeError as e:
            print(f"File {file_path} has invalid UTF-8 at {e.start}")
            # Snippet of problematic area
            start = max(0, e.start - 20)
            end = min(len(content), e.start + 20)
            print(f"Hex snippet: {content[start:end].hex()}")
            
    except Exception as e:
        print(f"Error checking file: {e}")

check_encoding('src/App.tsx')
