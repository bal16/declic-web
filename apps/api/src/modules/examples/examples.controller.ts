import type { ExampleWork } from '@declic/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';

import { CreateExampleWorkDto, ExampleWorkDto } from './dto';
import { ExamplesService } from './examples.service';

@Controller('examples/works')
export class ExamplesController {
  constructor(private readonly examples: ExamplesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ZodResponse({ type: ExampleWorkDto })
  create(@Body() dto: CreateExampleWorkDto): ExampleWork {
    return this.examples.create(dto);
  }

  @Get(':id')
  @ZodResponse({ type: ExampleWorkDto })
  findOne(@Param('id') id: string): ExampleWork {
    return this.examples.findOne(id);
  }
}
