import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

/** Rejects ids that are not a 24-char hex MongoDB ObjectId with 400 "Invalid id". */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
      throw new BadRequestException('Invalid id');
    }
    return value;
  }
}
