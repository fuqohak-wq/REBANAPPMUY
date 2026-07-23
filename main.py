import os
import glob
import subprocess
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from faster_whisper import WhisperModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = WhisperModel("base", device="cpu", compute_type="int8")

JOBS = {}

def format_timestamp(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def process_video_job(job_id: str, audio_path: str, image_path: str):
    try:
        JOBS[job_id] = {"status": "processing", "message": "1/3 Transkripsi lirik dengan Whisper..."}

        segments, _ = model.transcribe(audio_path, beam_size=5)
        srt_path = f"{job_id}.srt"

        with open(srt_path, "w", encoding="utf-8") as f:
            for i, segment in enumerate(segments, start=1):
                start_str = format_timestamp(segment.start)
                end_str = format_timestamp(segment.end)
                f.write(f"{i}\n{start_str} --> {end_str}\n{segment.text.strip()}\n\n")

        JOBS[job_id] = {"status": "processing", "message": "2/3 Rendering video dengan FFmpeg..."}

        output_video = f"{job_id}_output.mp4"

        vf_filter = f"subtitles={srt_path}:force_style='FontSize=22,PrimaryColour=&H00FFFFFF&,BackColour=&H80000000&,BorderStyle=4,Alignment=2'"

        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", image_path,
            "-i", audio_path,
            "-vf", vf_filter,
            "-c:v", "libx264", "-tune", "stillimage", "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-shortest", output_video
        ]

        subprocess.run(cmd, check=True)

        JOBS[job_id] = {
            "status": "completed", 
            "message": "🎉 Selesai! Video siap diunduh.",
            "download_url": f"/download/{job_id}"
        }

    except Exception as e:
        JOBS[job_id] = {"status": "failed", "message": f"Error: {str(e)}"}

@app.post("/generate-video")
async def generate_video(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    image: UploadFile = File(...)
):
    import uuid
    job_id = str(uuid.uuid4())

    audio_path = f"{job_id}_{audio.filename}"
    image_path = f"{job_id}_{image.filename}"

    with open(audio_path, "wb") as f:
        f.write(await audio.read())

    with open(image_path, "wb") as f:
        f.write(await image.read())

    JOBS[job_id] = {"status": "queued", "message": "Mulai memproses di background..."}

    background_tasks.add_task(process_video_job, job_id, audio_path, image_path)

    return {"job_id": job_id}

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    return JOBS.get(job_id, {"status": "not_found", "message": "Job tidak ditemukan"})

@app.get("/download/{job_id}")
async def download_video(job_id: str):
    output_video = f"{job_id}_output.mp4"
    if os.path.exists(output_video):
        return FileResponse(output_video, media_type="video/mp4", filename="music_video_lyric.mp4")
    return {"error": "File tidak ditemukan"}
