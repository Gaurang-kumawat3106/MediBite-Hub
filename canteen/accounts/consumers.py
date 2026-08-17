# import json
# from channels.generic.websocket import AsyncWebsocketConsumer
# from channels.db import database_sync_to_async

# class OrderConsumer(AsyncWebsocketConsumer):
#     async def connect(self):
#         self.user = self.scope["user"]
        
#         if self.user.is_anonymous:
#             await self.close()
#             return

#         # Users join a group specific to themselves (for order updates)
#         self.user_group_name = f"user_{self.user.id}"
#         await self.channel_layer.group_add(
#             self.user_group_name,
#             self.channel_name
#         )

#         # If it's an outlet head, join the outlet's group too (for new orders)
#         if hasattr(self.user, 'is_outlet_head') and self.user.is_outlet_head:
#             if hasattr(self.user, 'outlet'):
#                 self.outlet_group_name = f"outlet_{self.user.outlet.id}"
#                 await self.channel_layer.group_add(
#                     self.outlet_group_name,
#                     self.channel_name
#                 )
        
#         await self.accept()
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class OrderConsumer(AsyncWebsocketConsumer):

    @database_sync_to_async
    def get_user_info(self, scope):
        user = scope.get("user")
        if not user or user.is_anonymous:
            return None
        outlet_id = None
        if hasattr(user, 'outlet'):
            try:
                outlet_id = user.outlet.id
            except:
                outlet_id = None
        return {
            "id": user.id,
            "is_customer": getattr(user, "is_customer", False),
            "is_outlet_head": getattr(user, "is_outlet_head", False),
            "outlet_id": outlet_id,
        }

    async def connect(self):
        await self.accept()

        # All connected clients join public customers group for real-time menu updates
        await self.channel_layer.group_add("customers", self.channel_name)

        user_info = await self.get_user_info(self.scope)
        if user_info:
            self.user_group_name = f"user_{user_info['id']}"
            await self.channel_layer.group_add(self.user_group_name, self.channel_name)

            if user_info.get("is_outlet_head") and user_info.get("outlet_id"):
                self.outlet_group_name = f"outlet_{user_info['outlet_id']}"
                await self.channel_layer.group_add(self.outlet_group_name, self.channel_name)

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(self.user_group_name, self.channel_name)
        
        if hasattr(self, 'outlet_group_name'):
            await self.channel_layer.group_discard(self.outlet_group_name, self.channel_name)

        await self.channel_layer.group_discard("customers", self.channel_name)

    # Receive message from customers group
    async def product_deactivated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'product_deactivated',
            'product_id': event.get('product_id'),
            'product_name': event.get('product_name', '')
        }))

    # Receive message from user_group and outlet_group
    async def order_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'order_update',
            'order_id': event.get('order_id'),
            'status': event.get('status'),
            'token_no': event.get('token_no'),
            'message': event.get('message', '')
        }))

    # Receive message from outlet_group
    async def new_order(self, event):
        await self.send(text_data=json.dumps({
            'type': 'new_order',
            'order_id': event.get('order_id'),
            'customer_name': event.get('customer_name', 'Guest'),
            'total_amount': str(event.get('total_amount', '0.00'))
        }))

    # Receive token update
    async def token_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'token_update',
            'order_id': event.get('order_id'),
            'token_no': event.get('token_no'),
            'message': event.get('message', '')
        }))
