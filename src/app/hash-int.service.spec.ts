import { TestBed } from '@angular/core/testing';

import { HashIntService } from './hash-int.service';

describe('HashIntService', () => {
  let service: HashIntService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HashIntService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
