import { Injectable } from '@angular/core';



@Injectable({
  providedIn: 'root'
})
export class HashIntService {

  constructor() { }
  // Source: http://burtleburtle.net/bob/hash/integer.html
  static hashInt(x: number): number {
    const A = new Uint32Array(1);
    A[0]  = x|0;
    A[0] -= (A[0]<<6);
    A[0] ^= (A[0]>>>17);
    A[0] -= (A[0]<<9);
    A[0] ^= (A[0]<<4);
    A[0] -= (A[0]<<3);
    A[0] ^= (A[0]<<10);
    A[0] ^= (A[0]>>>15);
    return A[0];
  }
}
