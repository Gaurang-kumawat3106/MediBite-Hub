import json
from channels.generic.websocket import AsyncWebsocketConsumer

class OrderConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        
        if self.user.is_anonymous:
            await self.close()
            return

        # Users join a group specific to themselves (for order updates)
        self.user_group_name = f"user_{self.user.id}"
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )

        # If it's an outlet head, join the outlet's group too (for new orders)
        if hasattr(self.user, 'is_outlet_head') and self.user.is_outlet_head:
            if hasattr(self.user, 'outlet'):
                self.outlet_group_name = f"outlet_{self.user.outlet.id}"
                await self.channel_layer.group_add(
                    self.outlet_group_name,
                    self.channel_name
                )
        
        await self.accept()

    async def disconnect(self, close_code):
        # Leave user group
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )
        
        # Leave outlet group
        if hasattr(self, 'outlet_group_name'):
            await self.channel_layer.group_discard(
                self.outlet_group_name,
                self.channel_name
            )

    # Receive message from user_group
    async def order_update(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'order_update',
            'order_id': event['order_id'],
            'status': event['status'],
            'message': event['message']
        }))

    # Receive message from outlet_group
    async def new_order(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'new_order',
            'order_id': event['order_id'],
            'customer_name': event['customer_name'],
            'total_amount': event['total_amount']
        }))

    # Receive token update
    async def token_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'token_update',
            'order_id': event['order_id'],
            'token_no': event['token_no'],
            'message': event['message']
        }))
