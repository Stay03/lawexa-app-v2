import type { VoiceConversation } from '@elevenlabs/react';
import type { VoiceCallHandlers, VoiceCallStart, VoiceSession } from './voice-session';

/**
 * The real call: ElevenLabs' web client over WebRTC, with the single-use
 * token the server handed out (Stay's yes for `@elevenlabs/react`, 21
 * November 2026 12:03Z). The client is loaded when a call starts, so the page
 * itself stays light and nothing touches the microphone before Call.
 */
export class ElevenLabsVoiceSession implements VoiceSession {
  private conversation: VoiceConversation | null = null;
  private ended = false;

  async start(options: VoiceCallStart, handlers: VoiceCallHandlers) {
    const { Conversation } = await import('@elevenlabs/react');
    const conversation = await Conversation.startSession({
      conversationToken: options.conversationToken,
      connectionType: 'webrtc',
      textOnly: false,
      userId: options.userId,
      customLlmExtraBody: options.customLlmExtraBody,
      overrides: { tts: { voiceId: options.voiceId } },
      ...(options.dynamicVariables ? { dynamicVariables: options.dynamicVariables } : {}),
      onStatusChange: ({ status }) => {
        if (status === 'connected' || status === 'connecting' || status === 'disconnected') handlers.onStatus(status);
      },
      onModeChange: ({ mode }) => handlers.onMode(mode),
      onMessage: ({ message, role }) => handlers.onMessage({ source: role === 'user' ? 'user' : 'ai', text: message }),
      onError: (message) => handlers.onError(message || 'The call failed.'),
      onVadScore: ({ vadScore }) => handlers.onVad?.(vadScore),
    });
    if (this.ended) {
      await conversation.endSession();
      return;
    }
    this.conversation = conversation;
  }

  async end() {
    this.ended = true;
    const conversation = this.conversation;
    this.conversation = null;
    await conversation?.endSession();
  }

  setMuted(muted: boolean) {
    this.conversation?.setMicMuted(muted);
  }

  sendUserMessage(text: string) {
    this.conversation?.sendUserMessage(text);
  }

  conversationId() {
    return this.conversation?.getId() ?? null;
  }
}
