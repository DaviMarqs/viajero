from rest_framework.response import Response

def api_response(*, status_bool, message, data=None, errors=None, http_status=200):

    response = {
        "status": "success" if status_bool else "error",
        "message": message
    }

    if data is not None:
        response["data"] = data

    if errors is not None:
        response["errors"] = errors

    return Response(response, status=http_status)