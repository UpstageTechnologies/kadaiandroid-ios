let voiceCommandHandler = null;

export const registerVoiceCommandHandler = handler => {
  voiceCommandHandler = handler;

  return () => {
    if (voiceCommandHandler === handler) {
      voiceCommandHandler = null;
    }
  };
};

export const sendVoiceCommand = async command => {
  if (!voiceCommandHandler) {
    throw new Error('The shopping screen is not ready to handle this request.');
  }

  return voiceCommandHandler(command);
};
