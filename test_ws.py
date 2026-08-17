import asyncio
import websockets

async def test_connection():
    uri = "wss://api.bhukkadbox.in/ws/orders/"
    try:
        async with websockets.connect(uri) as websocket:
            print("Successfully connected to", uri)
            # Send a dummy message just to see
            await websocket.send('{"type": "ping"}')
            response = await websocket.recv()
            print("Received:", response)
    except Exception as e:
        print("WebSocket connection failed:", e)

asyncio.get_event_loop().run_until_complete(test_connection())
