import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cart } from './entities/cart.entity';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { ThrowErrors } from '../../commons/functions/throw-errors';
import { CartProduct } from './entities/cart-product.entity';
import { Order } from '../order/entities/order.entity';
import { OrderDto } from '../order/dto/order.dto';
import { OrderService } from '../order/order.service';
import { CreatePaymentDto } from '../payment/dto/create-payment.dto';
import { PaymentService } from '../payment/payment.service';
import { ProductService } from '../product/product.service';
import { RemoveCartItem } from '../../commons/interfaces/remove-cart-item';
import NotFound = ThrowErrors.NotFound;
import { Invoice } from '../invoice/invoice.entity';
import { Payment } from '../payment/payment.entity';


@Injectable()
export class CartService {
  constructor(@InjectRepository(Cart) public readonly cartRepository: Repository<Cart>,
              @InjectRepository(CartProduct) private readonly cartProductRepository: Repository<CartProduct>,
              private orderService: OrderService,
              private paymentService: PaymentService,
              @Inject(forwardRef(() => ProductService)) private productService: ProductService) {
  }

  async createCart(user: User): Promise<Cart> {
    const cart = new Cart();
    cart.cartProducts = [];
    cart.user = user;
    cart.totalItems = 0;
    const savedCart = await cart.save();
    return savedCart;
  }

  async getCart(id: number) {
    const queryBuilder = this.cartRepository.createQueryBuilder('cart');
    const cart = await queryBuilder.leftJoinAndSelect('cart.cartProducts', 'cartProduct')
      .where({ id }).getOne();
    return cart;
  }

  async getTotalCarts() {
    return await this.cartRepository.createQueryBuilder().getCount();
  }

  async updateCartProductQuantity(cartId: number, cartProductId: number, newQuantity: number) {
    const cart = await this.getUserCart(null, cartId);
    for (let i = 0; i < cart.cartProducts.length; i++) {
      if (cart.cartProducts[i].id === cartProductId) {
        cart.cartProducts[i].quantity = newQuantity;
        const product = await this.productService.getProductById(cart.cartProducts[i].productId);
        cart.cartProducts[i].totalPrice = 0;
        cart.cartProducts[i].totalPrice = product.currentPrice * newQuantity;
        await cart.cartProducts[i].save();
      }
    }
    return await cart.save();
  }

  async removeCartProduct(cartId: number, cartProductId: number) {
    const cart = await this.getUserCart(null, cartId);
    for (let i = 0; i < cart.cartProducts.length; i++) {
      if (cart.cartProducts[i].id === cartProductId) {
        cart.cartProducts = cart.cartProducts.filter(cp => cp.id !== cartProductId);
        cart.totalItems = cart.totalItems - 1;
        await this.cartProductRepository.delete(cartProductId);
      }
    }
    return await cart.save();
  }

  async checkoutOnSingleProduct(user: User,
                                cartProductId: number,
                                createOrderDto: OrderDto,
                                createPaymentDto: CreatePaymentDto):
    Promise<{
      order: Order,
      invoice: Invoice,
      payment: Payment,
      cart: Cart,
      customerId: string
    }> {
    const cart = await this.getUserCart(user);
    const cartProduct = cart.cartProducts.find(cProd => cProd.id === cartProductId);
    if (!cartProduct) {
      NotFound('Cart Product', cartProductId);
    }

    const order = await this.orderService.createOrder(user, createOrderDto);
    await this.orderService.createOrderItem(order, cartProduct);
    await this.removeProductsFromCart(cart.id,
      [{ cartProductId: cartProduct.id, productId: cartProduct.productId }], false);
    const data = await this.completeCreatingInvoiceAndPayment(
      user,
      createPaymentDto,
      order,
    );
    return {
      order: data.order,
      invoice: data.invoice,
      payment: data.payment,
      cart: data.cart,
      customerId: data.customerId,
    };

  }

  async completeCreatingInvoiceAndPayment(user: User, createPaymentDto: CreatePaymentDto, order: Order, cart?: Cart) {
    const { payment, invoice, customerId } = await this.paymentService.createPayment(user, createPaymentDto, order);
    return {
      order,
      payment,
      invoice,
      customerId,
      cart,
    };
  }

  async checkoutOnCart(user: User, createOrderDto: OrderDto, createPaymentDto: CreatePaymentDto):
    Promise<{
      order: Order,
      invoice: Invoice,
      payment: Payment,
      cart: Cart
    }> {
    const cart = await this.getUserCart(user);
    const order = await this.orderService.createOrder(user, createOrderDto);
    for (let i = 0; i < cart.cartProducts.length; i++) {
      await this.orderService.createOrderItem(order, cart.cartProducts[i]);
    }

    const clearedCart = await this.clearCart(cart, null, false);
    const data = await this.completeCreatingInvoiceAndPayment(
      user,
      createPaymentDto,
      order,
      clearedCart,
    );
    return {
      order: data.order,
      invoice: data.invoice,
      payment: data.payment,
      cart: clearedCart,
    };
  }

  async getUserCart(user?: User, id?: number): Promise<Cart> {
    let cart = null;
    const query = this.cartRepository.createQueryBuilder('cart');
    if (user) {
      cart = await query.leftJoinAndSelect('cart.cartProducts', 'cartProduct')
        .where('cart.id = :id', { id: user.cartId }).getOne();
    } else if (id) {
      cart = await query.leftJoinAndSelect('cart.cartProducts', 'cartProduct')
        .where('cart.id = :id', { id: id }).getOne();
    } else {
      NotFound('Cart', user.cartId || id);
    }
    return cart;
  }


  async clearCart(currentCart?: Cart, id?: number, updateProductQuantity?: boolean): Promise<Cart> {
    if (currentCart) {
      return this.clearCartContent(currentCart, updateProductQuantity);
    } else if (id) {
      const userCart = await this.getUserCart(null, id);
      return this.clearCartContent(userCart, updateProductQuantity);
    }
  }

  async clearCartContent(cart: Cart, updateProductQuantity: boolean) {
    for (let i = 0; i < cart.cartProducts.length; i++) {
      if (updateProductQuantity) {
        await this.refreshProductQuantity(cart.cartProducts[i]);
      }
      await this.cartProductRepository.delete(cart.cartProducts[i].id);
    }
    cart.cartProducts = [];
    cart.totalItems = 0;
    return await cart.save();
  }

  async refreshProductQuantity(cartProduct: CartProduct) {
    const product = await this.productService.getProductById(cartProduct.productId);
    product.quantity = product.quantity + cartProduct.quantity;
    await product.save();
  }

  async removeProductsFromCart(id: number, cartProducts: RemoveCartItem[], updateProductQuantity: boolean): Promise<Cart> {
    const cart = await this.getUserCart(null, id);
    for (let i = 0; i < cartProducts.length; i++) {
      const cartProduct = cart.cartProducts.find(prod => prod.id === cartProducts[i].cartProductId);
      if (cartProduct) {
        if (updateProductQuantity) {
          await this.refreshProductQuantity(cartProduct);
        }
        await this.cartProductRepository.delete(cartProducts[i].cartProductId);
        cart.totalItems -= 1;
      }
    }
    return await cart.save();
  }

}
