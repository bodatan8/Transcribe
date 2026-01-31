import azure.functions as func
import logging
import json
import os
import tempfile
import requests
import azure.cognitiveservices.speech as speechsdk
from supabase import create_client

app = func.FunctionApp()

# Environment variables
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')
SPEECH_KEY = os.environ.get('AZURE_SPEECH_KEY')
SPEECH_REGION = os.environ.get('AZURE_SPEECH_REGION', 'australiaeast')

@app.function_name(name="TranscribeAudio")
@app.route(route="transcribe", methods=["POST"])
def transcribe_audio(req: func.HttpRequest) -> func.HttpResponse:
    """
    HTTP trigger to transcribe audio from Supabase storage.
    
    Request body:
    {
        "recording_id": "uuid",
        "audio_url": "https://..."
    }
    """
    logging.info('Transcribe audio function triggered')
    
    try:
        req_body = req.get_json()
        recording_id = req_body.get('recording_id')
        audio_url = req_body.get('audio_url')
        
        if not recording_id or not audio_url:
            return func.HttpResponse(
                json.dumps({"error": "Missing recording_id or audio_url"}),
                status_code=400,
                mimetype="application/json"
            )
        
        logging.info(f'Processing recording: {recording_id}')
        
        # Download audio file
        audio_response = requests.get(audio_url)
        if audio_response.status_code != 200:
            raise Exception(f"Failed to download audio: {audio_response.status_code}")
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as temp_file:
            temp_file.write(audio_response.content)
            temp_path = temp_file.name
        
        try:
            # Transcribe using Azure Speech SDK
            transcript = transcribe_with_speech_sdk(temp_path)
            
            # Update database
            if SUPABASE_URL and SUPABASE_KEY:
                supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
                supabase.table('recordings').update({
                    'transcription': transcript,
                    'transcription_status': 'completed'
                }).eq('id', recording_id).execute()
                
                # Extract and save actions
                if transcript:
                    actions = extract_actions(transcript)
                    if actions:
                        # Get user_id from recording
                        recording = supabase.table('recordings').select('user_id').eq('id', recording_id).single().execute()
                        user_id = recording.data.get('user_id')
                        
                        for action in actions:
                            action['recording_id'] = recording_id
                            action['user_id'] = user_id
                            action['status'] = 'pending'
                        
                        supabase.table('actions').insert(actions).execute()
                        logging.info(f'Created {len(actions)} actions')
            
            return func.HttpResponse(
                json.dumps({
                    "success": True,
                    "recording_id": recording_id,
                    "transcript": transcript
                }),
                status_code=200,
                mimetype="application/json"
            )
        finally:
            # Cleanup temp file
            os.unlink(temp_path)
            
    except Exception as e:
        logging.error(f'Error: {str(e)}')
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )


def transcribe_with_speech_sdk(audio_path: str) -> str:
    """Transcribe audio file using Azure Speech SDK with continuous recognition."""
    
    if not SPEECH_KEY:
        raise Exception("Azure Speech key not configured")
    
    # Configure speech
    speech_config = speechsdk.SpeechConfig(
        subscription=SPEECH_KEY,
        region=SPEECH_REGION
    )
    speech_config.speech_recognition_language = "en-AU"
    speech_config.request_word_level_timestamps()
    
    # Use audio file
    audio_config = speechsdk.audio.AudioConfig(filename=audio_path)
    
    # Create recognizer
    speech_recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config,
        audio_config=audio_config
    )
    
    # Collect all recognized text
    all_results = []
    done = False
    
    def handle_result(evt):
        if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
            all_results.append(evt.result.text)
            logging.info(f'Recognized: {evt.result.text}')
    
    def handle_session_stopped(evt):
        nonlocal done
        done = True
    
    def handle_canceled(evt):
        nonlocal done
        logging.error(f'Recognition canceled: {evt.cancellation_details.reason}')
        if evt.cancellation_details.reason == speechsdk.CancellationReason.Error:
            logging.error(f'Error details: {evt.cancellation_details.error_details}')
        done = True
    
    # Connect callbacks
    speech_recognizer.recognized.connect(handle_result)
    speech_recognizer.session_stopped.connect(handle_session_stopped)
    speech_recognizer.canceled.connect(handle_canceled)
    
    # Start continuous recognition
    speech_recognizer.start_continuous_recognition()
    
    # Wait for completion
    import time
    while not done:
        time.sleep(0.5)
    
    speech_recognizer.stop_continuous_recognition()
    
    # Join all results
    transcript = ' '.join(all_results)
    logging.info(f'Full transcript: {transcript}')
    
    return transcript


def extract_actions(transcript: str) -> list:
    """Extract actions from transcript using pattern matching."""
    
    if not transcript:
        return []
    
    actions = []
    sentences = transcript.replace('!', '.').replace('?', '.').split('.')
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        
        lower = sentence.lower()
        
        # Email patterns
        if 'email' in lower or 'send' in lower:
            import re
            email_match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', sentence)
            if email_match:
                actions.append({
                    'action_type': 'email',
                    'title': f'Email {email_match.group(1)}',
                    'description': sentence,
                    'metadata': {'recipient': email_match.group(1)}
                })
                continue
        
        # Call patterns
        if 'call' in lower or 'phone' in lower or 'ring' in lower:
            import re
            name_match = re.search(r'(?:call|phone|ring)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', sentence)
            if name_match:
                name = name_match.group(1)
                # Skip generic words
                if name.lower() not in ['the', 'a', 'my', 'our', 'them', 'back']:
                    actions.append({
                        'action_type': 'call',
                        'title': f'Call {name}',
                        'description': sentence,
                        'metadata': {'contact': name}
                    })
                    continue
        
        # Meeting patterns
        if 'meeting' in lower or 'meet with' in lower or 'schedule' in lower:
            import re
            name_match = re.search(r'(?:meet(?:ing)?|schedule)\s+(?:with\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', sentence)
            if name_match:
                name = name_match.group(1)
                if name.lower() not in ['the', 'a', 'my', 'our']:
                    actions.append({
                        'action_type': 'meeting',
                        'title': f'Meeting with {name}',
                        'description': sentence,
                        'metadata': {'contact': name}
                    })
                    continue
        
        # Task patterns (need to, should, must)
        if any(x in lower for x in ['need to', 'should', 'must', 'have to']):
            import re
            task_match = re.search(r'(?:need to|should|must|have to)\s+(.{10,60}?)(?:\.|$)', sentence, re.IGNORECASE)
            if task_match:
                task = task_match.group(1).strip()
                actions.append({
                    'action_type': 'task',
                    'title': task[:50],
                    'description': sentence,
                    'metadata': {}
                })
    
    # Deduplicate by title
    seen = set()
    unique_actions = []
    for action in actions:
        key = action['title'].lower()
        if key not in seen:
            seen.add(key)
            unique_actions.append(action)
    
    return unique_actions
