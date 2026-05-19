# Image-to-TikZ backend diagnostic contract

The Stage 10D frontend sends image-to-TikZ requests through `AIProvider.ask(...)`
to the configured AI proxy URL.

For image understanding to work, the AI proxy must not flatten the request into
text-only prompt data. It must pass the image to a vision-capable model.

The request includes all three common shapes so the backend can choose one:

## Responses-style input

```json
{
  "payload": {
    "input": [
      {
        "role": "user",
        "content": [
          {"type": "input_text", "text": "..."},
          {"type": "input_image", "image_url": "data:image/png;base64,..."}
        ]
      }
    ]
  }
}
```

## Chat-style messages

```json
{
  "payload": {
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "..."},
          {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
        ]
      }
    ]
  }
}
```

## Legacy field

```json
{
  "payload": {
    "image": {
      "path": "figures/example.png",
      "mime": "image/png",
      "dataUrl": "data:image/png;base64,..."
    }
  }
}
```

If the backend ignores these image fields and only sends `payload.input` or
`payload.textInput` as plain text, the model will not see the image. The frontend
will then refuse to insert a generic rectangle placeholder and will ask for a
short user description such as `simple car`.

## How to diagnose from the app

1. Open the app with:
   `?v=stage10d-image-ai-backend-diagnostics-1`
2. Go to `Figures → Image → TikZ remaker`.
3. Select the image.
4. Click `Diagnose backend`.
5. Read/copy the backend diagnostic report.

If the report says the model cannot see the image, the AI proxy needs to be updated
to forward one of the image payload formats above to a vision-capable model.
