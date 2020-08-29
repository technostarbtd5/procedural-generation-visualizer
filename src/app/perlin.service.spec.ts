import { TestBed } from '@angular/core/testing';

import { PerlinService } from './perlin.service';

describe('PerlinService', () => {
  let service: PerlinService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PerlinService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
