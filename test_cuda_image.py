import modal
import subprocess

image = modal.Image.from_registry("nvidia/cuda:12.1.1-devel-ubuntu22.04", add_python="3.11")
app = modal.App("test-cuda-image", image=image)

@app.function()
def test_cuda():
    try:
        res = subprocess.run(["nvcc", "--version"], capture_output=True, text=True)
        print("NVCC Version Output:\n", res.stdout)
        return True
    except Exception as e:
        print("Failed to run nvcc:", e)
        return False
