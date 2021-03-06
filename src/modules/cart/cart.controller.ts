import { Body, Controller, Delete, Get, Param, ParseArrayPipe, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserAuthGuard } from '../../commons/guards/user-auth.guard';
import { GetAuthenticatedUser } from '../../commons/decorators/get-authenticated-user.decorator';
import { User } from '../auth/entities/user.entity';
import { CartService } from './cart.service';
import { Roles } from '../../commons/decorators/roles.decorator';
import { OrderDto } from '../order/dto/order.dto';
import { CreatePaymentDto } from '../payment/dto/create-payment.dto';
import { RemoveCartItem } from '../../commons/interfaces/remove-cart-item';
import { UserRole } from '../../commons/enums/user-role.enum';

@UseGuards(AuthGuard(), UserAuthGuard)
@Roles(UserRole.USER)
@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {
  }

  @Post('create-user-cart')
  createUserCart(@GetAuthenticatedUser() user: User) {
    return this.cartService.createCart(user);
  }

  @Get('count')
  getTotalCarts() {
    return this.cartService.getTotalCarts();
  }


  @Get('user-cart')
  getUserCart(@GetAuthenticatedUser() user: User) {
    return this.cartService.getUserCart(user);
  }

  @Post('checkout-on-cart')
  checkoutOnCart(@GetAuthenticatedUser() user: User,
                 @Body('createOrderDto') createOrderDto: OrderDto,
                 @Body('createPaymentDto') createPaymentDto: CreatePaymentDto) {
    return this.cartService.checkoutOnCart(user, createOrderDto, createPaymentDto);
  }

  @Post('checkout-on-single-product/:cartProductId')
  checkoutOnSingleProduct(@GetAuthenticatedUser() user: User,
                          @Param('cartProductId', ParseIntPipe) cartProductId: number,
                          @Body('createOrderDto') createOrderDto: OrderDto,
                          @Body('createPaymentDto') createPaymentDto: CreatePaymentDto) {
    return this.cartService.checkoutOnSingleProduct(user, cartProductId, createOrderDto, createPaymentDto);
  }

  @Delete('clear-cart')
  clearCart(@GetAuthenticatedUser() user: User) {
    return this.cartService.clearCart(null, user.cartId, true);
  }

  @Delete('remove-products-from-cart')
  removeProductsFromCart(@GetAuthenticatedUser() user: User,
                         @Body('cartProducts', ParseArrayPipe) cartProducts: RemoveCartItem[]) {
    return this.cartService.removeProductsFromCart(user.cartId, cartProducts, true);
  }

  @Delete(':cartId/remove-product-from-cart/:cartProductId')
  removeCartProductFromCart(@Param('cartId', ParseIntPipe) cartId: number,
                            @Param('cartProductId', ParseIntPipe) cartProductId: number) {
    return this.cartService.removeCartProduct(cartId, cartProductId);
  }

  @Put(':cartId/update-product-cart-quantity/:cartProductId')
  updateCartProductQuantity(@Param('cartId', ParseIntPipe) cartId: number,
                            @Param('cartProductId', ParseIntPipe) cartProductId: number,
                            @Query('newQuantity', ParseIntPipe) newQuantity: number) {
    return this.cartService.updateCartProductQuantity(cartId, cartProductId, newQuantity);
  }
}
