package com.vaidyaashwani.livecalltranslator

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Base64
import android.webkit.JavascriptInterface
import java.io.File
import java.util.Locale

/**
 * window.AndroidBridge – JavaScript se call hone wale native functions.
 * JS callbacks: window.NativeSpeech.onPartial/onFinal/onEnd/onError/onSpeakDone
 */
class NativeBridge(private val act: MainActivity) {

    private val main = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    @Volatile private var ttsReady = false
    private val audio = act.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    init {
        tts = TextToSpeech(act.applicationContext) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
        }
        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String?) {}
            override fun onDone(id: String?) { act.callJs("window.NativeSpeech.onSpeakDone", id) }
            @Deprecated("Deprecated in Java")
            override fun onError(id: String?) { act.callJs("window.NativeSpeech.onSpeakDone", id) }
            override fun onError(id: String?, errorCode: Int) { act.callJs("window.NativeSpeech.onSpeakDone", id) }
        })
    }

    /* ======================= Speech → Text ======================= */

    @JavascriptInterface
    fun startListening(locale: String, continuous: Boolean) {
        main.post {
            if (!SpeechRecognizer.isRecognitionAvailable(act)) {
                act.callJs("window.NativeSpeech.onError", "not-available", "Speech service nahi mili")
                act.callJs("window.NativeSpeech.onEnd")
                return@post
            }
            if (!act.hasPerm(android.Manifest.permission.RECORD_AUDIO)) {
                act.requestBasicPermissions()
                act.callJs("window.NativeSpeech.onError", "not-allowed", "")
                return@post
            }
            val r = recognizer ?: SpeechRecognizer.createSpeechRecognizer(act).also {
                it.setRecognitionListener(listener)
                recognizer = it
            }
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, locale)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, act.packageName)
                if (continuous) {
                    putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
                    putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
                }
            }
            try {
                r.cancel()
                r.startListening(intent)
            } catch (e: Exception) {
                act.callJs("window.NativeSpeech.onEnd")
            }
        }
    }

    @JavascriptInterface
    fun stopListening() {
        main.post { try { recognizer?.cancel() } catch (_: Exception) {} }
    }

    private fun first(b: Bundle?): String =
        b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.trim() ?: ""

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onEvent(eventType: Int, params: Bundle?) {}

        override fun onPartialResults(b: Bundle?) {
            val t = first(b)
            if (t.isNotEmpty()) act.callJs("window.NativeSpeech.onPartial", t)
        }

        override fun onResults(b: Bundle?) {
            val t = first(b)
            if (t.isNotEmpty()) act.callJs("window.NativeSpeech.onFinal", t)
            act.callJs("window.NativeSpeech.onEnd")
        }

        override fun onError(error: Int) {
            val code = when (error) {
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "not-allowed"
                SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED,
                SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "language-not-supported"
                SpeechRecognizer.ERROR_AUDIO -> "audio-capture"
                SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "network"
                SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "no-speech"
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "busy"
                SpeechRecognizer.ERROR_CLIENT -> "aborted"
                else -> "error-$error"
            }
            if (code == "busy") {   // purana session band karke dobara
                try { recognizer?.destroy() } catch (_: Exception) {}
                recognizer = null
            }
            if (code != "aborted") act.callJs("window.NativeSpeech.onError", code, "")
            act.callJs("window.NativeSpeech.onEnd")
        }
    }

    /* ======================= Text → Speech ======================= */

    /** true = phone ki voice se bol raha hai; false = voice nahi mili (JS online voice use karega). */
    @JavascriptInterface
    fun speak(text: String, locale: String, rate: Double, id: String): Boolean {
        val t = tts ?: return false
        if (!ttsReady) return false
        val loc = Locale.forLanguageTag(locale)
        val avail = t.isLanguageAvailable(loc)
        if (avail < TextToSpeech.LANG_AVAILABLE) return false
        t.language = loc
        t.setSpeechRate(rate.toFloat())
        val params = Bundle()
        return t.speak(text, TextToSpeech.QUEUE_ADD, params, id) == TextToSpeech.SUCCESS
    }

    @JavascriptInterface
    fun stopSpeaking() { try { tts?.stop() } catch (_: Exception) {} }

    /* ======================= Call audio mode ======================= */

    @JavascriptInterface
    fun setCallMode(on: Boolean) {
        main.post {
            act.keepScreenOn(on)
            try {
                if (on) {
                    audio.mode = AudioManager.MODE_IN_COMMUNICATION
                    val hasHeadset = audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any {
                        it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET || it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                            it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
                            it.type == AudioDeviceInfo.TYPE_USB_HEADSET
                    }
                    if (!hasHeadset) speaker(true)
                } else {
                    speaker(false)
                    audio.mode = AudioManager.MODE_NORMAL
                }
            } catch (_: Exception) {}
        }
    }

    @Suppress("DEPRECATION")
    private fun speaker(on: Boolean) {
        if (Build.VERSION.SDK_INT >= 31) {
            if (on) {
                audio.availableCommunicationDevices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
                    ?.let { audio.setCommunicationDevice(it) }
            } else audio.clearCommunicationDevice()
        } else {
            audio.isSpeakerphoneOn = on
        }
    }

    /* ======================= Files / share ======================= */

    /** PDF / recording ko Download/VaidyaAshwani folder me save karta hai aur khol deta hai. */
    @JavascriptInterface
    fun saveFile(base64: String, name: String, mime: String): String {
        return try {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            if (Build.VERSION.SDK_INT >= 29) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, name)
                    put(MediaStore.Downloads.MIME_TYPE, mime)
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/VaidyaAshwani")
                }
                val uri = act.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: return "Save nahi ho paya"
                act.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                main.post {
                    try {
                        act.startActivity(Intent(Intent.ACTION_VIEW).apply {
                            setDataAndType(uri, mime)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                        })
                    } catch (_: Exception) {}
                }
                "✅ Save ho gaya: Download/VaidyaAshwani/$name"
            } else {
                @Suppress("DEPRECATION")
                val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "VaidyaAshwani")
                val target = try { dir.mkdirs(); File(dir, name).also { it.writeBytes(bytes) } }
                catch (e: Exception) {
                    val d2 = File(act.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "VaidyaAshwani"); d2.mkdirs()
                    File(d2, name).also { it.writeBytes(bytes) }
                }
                "✅ Save ho gaya: ${target.absolutePath}"
            }
        } catch (e: Exception) {
            "Save nahi ho paya: ${e.message}"
        }
    }

    @JavascriptInterface
    fun shareText(text: String) {
        main.post {
            val send = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, text) }
            act.startActivity(Intent.createChooser(send, "Share karein"))
        }
    }

    @JavascriptInterface
    fun openExternal(url: String) { main.post { act.openExternal(url) } }

    @JavascriptInterface
    fun requestPermissions() { main.post { act.requestBasicPermissions() } }

    @JavascriptInterface
    fun notifyIncoming(name: String) { /* ring + vibration JS se hoti hai */ }

    @JavascriptInterface
    fun appVersion(): String = BuildConfig.VERSION_NAME

    fun shutdown() {
        try { recognizer?.destroy() } catch (_: Exception) {}
        try { tts?.shutdown() } catch (_: Exception) {}
        try { audio.mode = AudioManager.MODE_NORMAL } catch (_: Exception) {}
    }
}
