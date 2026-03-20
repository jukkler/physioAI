from config import USE_MOCKS


def get_whisper_service():
    if USE_MOCKS:
        from mock_services import whisper_mock
        return whisper_mock
    from services import whisper
    return whisper


def get_llm_service():
    if USE_MOCKS:
        from mock_services import llm_mock
        return llm_mock
    from services import llm
    return llm


def get_chat_service():
    if USE_MOCKS:
        from mock_services import chat_mock
        return chat_mock
    from services import chat
    return chat
