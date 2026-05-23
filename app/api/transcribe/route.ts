import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file" }, { status: 400 });
    }

    const whisperForm = new FormData();
    whisperForm.append("file", audioFile);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "pt");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
      },
      body: whisperForm,
    });

    const data = await res.json();

    if (data.text) {
      return NextResponse.json({ transcription: data.text });
    } else {
      return NextResponse.json({ error: "Falha na transcrição" }, { status: 500 });
    }
  } catch (error) {
    console.error("Transcription Error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
