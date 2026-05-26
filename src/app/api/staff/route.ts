import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { staffFormSchema } from '@/utils/validations';
import { ZodError } from 'zod';

// Constantes de Segurança (Zero Trust)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Extração do FormData (Multipart) em vez de JSON
    const formData = await request.formData();
    const dataStr = formData.get('data') as string;
    const avatarFile = formData.get('avatar') as File | null;

    if (!dataStr) {
      return NextResponse.json({ error: 'Payload de dados ausente' }, { status: 400 });
    }

    // 3. Validação da Foto (Zero Trust API Level)
    if (avatarFile) {
      if (!ALLOWED_MIME_TYPES.includes(avatarFile.type)) {
        return NextResponse.json({ error: 'A foto deve ser PNG ou JPEG.' }, { status: 400 });
      }
      if (avatarFile.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'A foto não pode ultrapassar 5MB.' }, { status: 400 });
      }
    }

    // 4. Validação Zod dos dados em texto
    const parsedJson = JSON.parse(dataStr);
    const validatedData = staffFormSchema.parse(parsedJson);

    // 5. Insere o profissional na tabela 'staff' (Ainda sem a foto)
    const { data: staffMember, error: staffError } = await supabase
      .from('staff')
      .insert({
        barbershop_id: validatedData.barbershop_id,
        profile_id: validatedData.profile_id || null,
        role: validatedData.role,
        full_name: validatedData.full_name,
        cpf: validatedData.cpf || null,
        cnpj: validatedData.cnpj || null,
        birth_date: validatedData.birth_date || null,
        address: validatedData.address || null,
        education_level: validatedData.education_level || null,
        barber_courses: validatedData.barber_courses || null,
        previous_experience: validatedData.previous_experience || null,
        payment_model: validatedData.payment_model,
        fixed_fee_amount: validatedData.fixed_fee_amount,
        is_active: true
      })
      .select('id, unique_code')
      .single();

    if (staffError) {
      if (staffError.code === '23505') {
        return NextResponse.json({ error: 'Este CPF ou CNPJ já está cadastrado nesta barbearia.' }, { status: 400 });
      }
      throw staffError;
    }

    // 6. Upload Seguro da Foto (Se existir)
    if (avatarFile) {
      const arrayBuffer = await avatarFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Regra de "1 única foto": Criamos um nome de arquivo fixo ("avatar") + extensão original
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `avatar.${fileExt}`;
      const filePath = `${staffMember.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('staff-avatars')
        .upload(filePath, buffer, {
          contentType: avatarFile.type,
          upsert: true // Se no futuro fizer UPDATE, o upsert substitui a imagem velha automaticamente!
        });

      if (!uploadError) {
        // Gera a URL pública da imagem recém-upada
        const { data: publicUrlData } = supabase.storage.from('staff-avatars').getPublicUrl(filePath);
        
        // Atualiza a tabela do staff com a URL da foto
        await supabase.from('staff').update({ avatar_url: publicUrlData.publicUrl }).eq('id', staffMember.id);
      } else {
        console.error("Erro no upload do avatar:", uploadError);
        // Não lançamos erro fatal aqui para não perder o cadastro que já foi feito, apenas avisamos.
      }
    }

    // 7. Insere as regras de comissão (se houver)
    if (validatedData.payment_model === 'commission' && validatedData.services_commissions?.length) {
      const commissionsToInsert = validatedData.services_commissions.map((sc) => ({
        staff_id: staffMember.id,
        service_id: sc.service_id,
        commission_percentage: sc.commission_percentage
      }));

      await supabase.from('staff_service_commissions').insert(commissionsToInsert);
    }

    return NextResponse.json({ success: true, data: staffMember }, { status: 201 });

  } catch (error: unknown) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 });
    if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}